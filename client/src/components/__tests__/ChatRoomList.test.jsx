import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const { getAllActiveChatRoomsMock, mockWs } = vi.hoisted(() => {
  const subscriptionCallbacks = {};
  return {
    getAllActiveChatRoomsMock: vi.fn(),
    mockWs: {
      _connectionListener: null,
      _subscriptionCallbacks: subscriptionCallbacks,
      isConnected: vi.fn(() => false),
      addConnectionListener: vi.fn((listener) => {
        mockWs._connectionListener = listener;
        return () => { mockWs._connectionListener = null; };
      }),
      subscribeToChatRoom: vi.fn((roomId, callback) => {
        subscriptionCallbacks[roomId] = callback;
        return { unsubscribe: vi.fn() };
      }),
      unsubscribeFromChatRoom: vi.fn(),
    },
  };
});

vi.mock('../../api/chatRoomService', () => ({
  chatRoomService: {
    getAllActiveChatRooms: (...args) => getAllActiveChatRoomsMock(...args),
    joinChatRoom: vi.fn(),
  },
}));

vi.mock('../../services/WebSocketService', () => ({
  default: mockWs,
}));

import ChatRoomList from '../ChatRoomList';

const baseUser = { id: 1, nickname: 'tester' };

function makeChatRooms() {
  return [
    {
      id: 10,
      name: '일반 채팅방',
      isMember: true,
      unreadCount: 0,
      lastMessageContent: '이전 메시지',
      lastMessageAt: '2026-02-27T08:00:00Z',
      memberCount: 3,
      memberAvatars: [],
    },
    {
      id: 20,
      name: '두번째 방',
      isMember: true,
      unreadCount: 2,
      lastMessageContent: '안녕',
      lastMessageAt: '2026-02-27T09:00:00Z',
      memberCount: 2,
      memberAvatars: [],
    },
    {
      id: 30,
      name: '미참가 방',
      isMember: false,
      unreadCount: 0,
      lastMessageContent: '',
      lastMessageAt: null,
      memberCount: 5,
      memberAvatars: [],
    },
  ];
}

/** WebSocket 연결을 시뮬레이션하는 헬퍼 */
async function simulateWsConnect() {
  await act(async () => {
    mockWs.isConnected.mockReturnValue(true);
    if (mockWs._connectionListener) mockWs._connectionListener(true);
  });
}

describe('ChatRoomList', () => {
  beforeEach(() => {
    getAllActiveChatRoomsMock.mockReset();
    mockWs.isConnected.mockReturnValue(false);
    mockWs.addConnectionListener.mockClear();
    mockWs.subscribeToChatRoom.mockClear();
    mockWs.unsubscribeFromChatRoom.mockClear();
    mockWs._connectionListener = null;
    Object.keys(mockWs._subscriptionCallbacks).forEach(
      (k) => delete mockWs._subscriptionCallbacks[k]
    );

    mockWs.addConnectionListener.mockImplementation((listener) => {
      mockWs._connectionListener = listener;
      return () => { mockWs._connectionListener = null; };
    });
    mockWs.subscribeToChatRoom.mockImplementation((roomId, callback) => {
      mockWs._subscriptionCallbacks[roomId] = callback;
      return { unsubscribe: vi.fn() };
    });
  });

  // --- 기본 동작 ---

  it('목록 로딩 실패 시 재시도 버튼 표시', async () => {
    getAllActiveChatRoomsMock
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce([]);

    render(<ChatRoomList user={baseUser} onSelectChatRoom={vi.fn()} />);

    expect(
      await screen.findByText('채팅방 목록을 불러오는데 실패했습니다.')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => {
      expect(getAllActiveChatRoomsMock).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('채팅방이 없습니다')).toBeInTheDocument();
  });

  // --- WebSocket 연결 상태 추적 ---

  it('WebSocket 연결 상태 리스너를 등록한다', async () => {
    getAllActiveChatRoomsMock.mockResolvedValue(makeChatRooms());

    render(<ChatRoomList user={baseUser} onSelectChatRoom={vi.fn()} />);

    await waitFor(() => {
      expect(mockWs.addConnectionListener).toHaveBeenCalledTimes(1);
    });
  });

  // --- WebSocket 연결 시 구독 ---

  it('WebSocket 연결 시 참가중인 방에만 구독한다', async () => {
    getAllActiveChatRoomsMock.mockResolvedValue(makeChatRooms());

    render(<ChatRoomList user={baseUser} onSelectChatRoom={vi.fn()} />);
    await screen.findByText('일반 채팅방');

    await simulateWsConnect();

    await waitFor(() => {
      expect(mockWs.subscribeToChatRoom).toHaveBeenCalledWith(10, expect.any(Function));
      expect(mockWs.subscribeToChatRoom).toHaveBeenCalledWith(20, expect.any(Function));
    });

    const subscribedRoomIds = mockWs.subscribeToChatRoom.mock.calls.map((c) => c[0]);
    expect(subscribedRoomIds).not.toContain(30);
  });

  // --- 실시간 메시지 갱신 ---

  it('타인 메시지 수신 시 마지막 메시지와 unreadCount가 갱신된다', async () => {
    getAllActiveChatRoomsMock.mockResolvedValue(makeChatRooms());

    render(<ChatRoomList user={baseUser} onSelectChatRoom={vi.fn()} />);
    await screen.findByText('일반 채팅방');
    await simulateWsConnect();
    await waitFor(() => expect(mockWs._subscriptionCallbacks[10]).toBeDefined());

    await act(async () => {
      mockWs._subscriptionCallbacks[10]({
        id: 100,
        senderId: 2,
        content: '새로운 메시지',
        type: 'TEXT',
        sentAt: '2026-02-27T10:00:00Z',
      });
    });

    expect(screen.getByText('새로운 메시지')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('본인 메시지 수신 시 unreadCount는 증가하지 않는다', async () => {
    getAllActiveChatRoomsMock.mockResolvedValue(makeChatRooms());

    render(<ChatRoomList user={baseUser} onSelectChatRoom={vi.fn()} />);
    await screen.findByText('일반 채팅방');
    await simulateWsConnect();
    await waitFor(() => expect(mockWs._subscriptionCallbacks[10]).toBeDefined());

    await act(async () => {
      mockWs._subscriptionCallbacks[10]({
        id: 101,
        senderId: baseUser.id,
        content: '내가 보낸 메시지',
        type: 'TEXT',
        sentAt: '2026-02-27T10:00:00Z',
      });
    });

    expect(screen.getByText('내가 보낸 메시지')).toBeInTheDocument();
    const roomRow = screen.getByText('일반 채팅방').closest('[class*="flex items-center gap-3"]');
    const badges = roomRow.querySelectorAll('.bg-red-500');
    expect(badges.length).toBe(0);
  });

  it('시스템 메시지 수신 시 unreadCount는 증가하지 않는다', async () => {
    getAllActiveChatRoomsMock.mockResolvedValue(makeChatRooms());

    render(<ChatRoomList user={baseUser} onSelectChatRoom={vi.fn()} />);
    await screen.findByText('일반 채팅방');
    await simulateWsConnect();
    await waitFor(() => expect(mockWs._subscriptionCallbacks[10]).toBeDefined());

    await act(async () => {
      mockWs._subscriptionCallbacks[10]({
        id: 102,
        senderId: 99,
        content: '누군가 입장했습니다.',
        type: 'SYSTEM',
        sentAt: '2026-02-27T10:00:00Z',
      });
    });

    expect(screen.getByText('누군가 입장했습니다.')).toBeInTheDocument();
    const roomRow = screen.getByText('일반 채팅방').closest('[class*="flex items-center gap-3"]');
    const badges = roomRow.querySelectorAll('.bg-red-500');
    expect(badges.length).toBe(0);
  });

  // --- 이미지/스티커 메시지 표시 ---

  it('이미지 메시지 수신 시 목록에 [사진]으로 표시된다', async () => {
    getAllActiveChatRoomsMock.mockResolvedValue(makeChatRooms());

    render(<ChatRoomList user={baseUser} onSelectChatRoom={vi.fn()} />);
    await screen.findByText('일반 채팅방');
    await simulateWsConnect();
    await waitFor(() => expect(mockWs._subscriptionCallbacks[10]).toBeDefined());

    await act(async () => {
      mockWs._subscriptionCallbacks[10]({
        id: 103,
        senderId: 2,
        content: 'data:image/png;base64,iVBOR...',
        type: 'IMAGE',
        sentAt: '2026-02-27T10:00:00Z',
      });
    });

    expect(screen.getByText('[사진]')).toBeInTheDocument();
  });

  it('스티커 메시지 수신 시 목록에 [스티커]로 표시된다', async () => {
    getAllActiveChatRoomsMock.mockResolvedValue(makeChatRooms());

    render(<ChatRoomList user={baseUser} onSelectChatRoom={vi.fn()} />);
    await screen.findByText('일반 채팅방');
    await simulateWsConnect();
    await waitFor(() => expect(mockWs._subscriptionCallbacks[10]).toBeDefined());

    await act(async () => {
      mockWs._subscriptionCallbacks[10]({
        id: 104,
        senderId: 2,
        content: '😄',
        type: 'STICKER',
        sentAt: '2026-02-27T10:00:00Z',
      });
    });

    expect(screen.getByText('[스티커]')).toBeInTheDocument();
  });

  it('data:image로 시작하는 TEXT 메시지도 [사진]으로 표시된다', async () => {
    getAllActiveChatRoomsMock.mockResolvedValue(makeChatRooms());

    render(<ChatRoomList user={baseUser} onSelectChatRoom={vi.fn()} />);
    await screen.findByText('일반 채팅방');
    await simulateWsConnect();
    await waitFor(() => expect(mockWs._subscriptionCallbacks[10]).toBeDefined());

    await act(async () => {
      mockWs._subscriptionCallbacks[10]({
        id: 105,
        senderId: 2,
        content: 'data:image/jpeg;base64,/9j/4AAQ...',
        type: 'TEXT',
        sentAt: '2026-02-27T10:00:00Z',
      });
    });

    expect(screen.getByText('[사진]')).toBeInTheDocument();
  });

  // --- 총 읽지 않은 수 부모 전달 ---

  it('onTotalUnreadChange에 참가중인 방들의 총 unreadCount를 전달한다', async () => {
    getAllActiveChatRoomsMock.mockResolvedValue(makeChatRooms());
    const onTotalUnreadChange = vi.fn();

    render(
      <ChatRoomList
        user={baseUser}
        onSelectChatRoom={vi.fn()}
        onTotalUnreadChange={onTotalUnreadChange}
      />
    );

    await screen.findByText('일반 채팅방');

    await waitFor(() => {
      expect(onTotalUnreadChange).toHaveBeenCalledWith(2);
    });
  });

  it('실시간 메시지 수신 후 onTotalUnreadChange 값이 갱신된다', async () => {
    getAllActiveChatRoomsMock.mockResolvedValue(makeChatRooms());
    const onTotalUnreadChange = vi.fn();

    render(
      <ChatRoomList
        user={baseUser}
        onSelectChatRoom={vi.fn()}
        onTotalUnreadChange={onTotalUnreadChange}
      />
    );

    await screen.findByText('일반 채팅방');
    await simulateWsConnect();
    await waitFor(() => expect(mockWs._subscriptionCallbacks[10]).toBeDefined());

    await act(async () => {
      mockWs._subscriptionCallbacks[10]({
        id: 200,
        senderId: 2,
        content: '새 메시지',
        type: 'TEXT',
        sentAt: '2026-02-27T10:00:00Z',
      });
    });

    await waitFor(() => {
      expect(onTotalUnreadChange).toHaveBeenCalledWith(3);
    });
  });

  // --- 필터 동작 ---

  it('filter=unread 시 읽지 않은 메시지가 있는 방만 표시한다', async () => {
    getAllActiveChatRoomsMock.mockResolvedValue(makeChatRooms());

    render(
      <ChatRoomList user={baseUser} filter="unread" onSelectChatRoom={vi.fn()} />
    );

    await screen.findByText('두번째 방');
    expect(screen.queryByText('일반 채팅방')).not.toBeInTheDocument();
    expect(screen.queryByText('미참가 방')).not.toBeInTheDocument();
  });

  describe('memberCount === 1이고 memberAvatars가 비어있을 때 본인 아바타 폴백', () => {
    const onSelectChatRoom = vi.fn();
    const room = {
      id: 10,
      name: '나만의 방',
      memberCount: 1,
      memberAvatars: [],
      isMember: true,
    };

    it('사용자에게 profileImage가 있으면 프로필 이미지를 렌더링한다', async () => {
      const user = {
        id: 1,
        nickname: 'Alice',
        profileImage: 'https://example.com/alice.png',
        profileColor: '#ff0000',
      };
      getAllActiveChatRoomsMock.mockResolvedValueOnce([room]);

      render(<ChatRoomList user={user} onSelectChatRoom={onSelectChatRoom} />);

      const img = await screen.findByAltText('프로필');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', user.profileImage);
    });

    it('사용자에게 profileImage가 없으면 닉네임 첫 글자 이니셜을 렌더링한다', async () => {
      const user = {
        id: 2,
        nickname: 'Bob',
        profileImage: null,
        profileColor: '#00ff00',
      };
      getAllActiveChatRoomsMock.mockResolvedValueOnce([room]);

      render(<ChatRoomList user={user} onSelectChatRoom={onSelectChatRoom} />);

      await screen.findByText('나만의 방');
      expect(screen.getByText('B')).toBeInTheDocument();
    });
  });
});
