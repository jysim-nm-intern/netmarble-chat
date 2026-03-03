import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const { mockWs, getChatRoomByIdMock, getAllActiveChatRoomsMock } = vi.hoisted(() => ({
  mockWs: {
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => false),
    addConnectionListener: vi.fn(() => () => {}),
    subscribeToChatRoom: vi.fn(() => ({ unsubscribe: vi.fn() })),
    unsubscribeFromChatRoom: vi.fn(),
    subscribeToReadStatus: vi.fn(() => ({ unsubscribe: vi.fn() })),
  },
  getChatRoomByIdMock: vi.fn(),
  getAllActiveChatRoomsMock: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/WebSocketService', () => ({ default: mockWs }));

vi.mock('../../api/chatRoomService', () => ({
  chatRoomService: {
    getChatRoomById: (...args) => getChatRoomByIdMock(...args),
    getAllActiveChatRooms: (...args) => getAllActiveChatRoomsMock(...args),
    joinChatRoom: vi.fn(),
  },
}));

vi.mock('../../api/messageService', () => ({
  messageService: { getChatRoomMessages: vi.fn(() => Promise.resolve([])) },
}));

vi.mock('../../api/readStatusService', () => ({
  readStatusService: { markAsRead: vi.fn(() => Promise.resolve()) },
}));

vi.mock('../../api/activityService', () => ({
  activityService: { updateActiveStatus: vi.fn(() => Promise.resolve()) },
}));

import ChatRoom from '../ChatRoom';

const baseUser = { id: 1, nickname: 'tester', profileColor: '#4f85c8' };

function renderChatRoom(user = baseUser) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ChatRoom user={user} onLogout={vi.fn()} />
    </MemoryRouter>
  );
}

describe('ChatRoom - WebSocket 수명주기', () => {
  beforeEach(() => {
    mockWs.connect.mockClear();
    mockWs.disconnect.mockClear();
    getAllActiveChatRoomsMock.mockResolvedValue([]);
  });

  it('마운트 시 webSocketService.connect()를 호출한다', async () => {
    renderChatRoom();

    await waitFor(() => {
      expect(mockWs.connect).toHaveBeenCalledTimes(1);
    });
  });

  it('언마운트 시 webSocketService.disconnect()를 호출한다', async () => {
    renderChatRoom();

    await waitFor(() => {
      expect(mockWs.connect).toHaveBeenCalledTimes(1);
    });

    cleanup();

    expect(mockWs.disconnect).toHaveBeenCalledTimes(1);
  });

  it('connect 실패해도 에러 없이 렌더링된다', async () => {
    mockWs.connect.mockRejectedValueOnce(new Error('connection failed'));

    renderChatRoom();

    await waitFor(() => {
      expect(mockWs.connect).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('채팅')).toBeInTheDocument();
  });
});
