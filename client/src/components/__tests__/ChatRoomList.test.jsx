import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ChatRoomList from '../ChatRoomList';

const getAllActiveChatRoomsMock = vi.fn();

vi.mock('../../api/chatRoomService', () => ({
  chatRoomService: {
    getAllActiveChatRooms: (...args) => getAllActiveChatRoomsMock(...args),
  },
}));

describe('ChatRoomList', () => {
  beforeEach(() => {
    getAllActiveChatRoomsMock.mockReset();
  });

  it('shows error and retries on load failure', async () => {
    const user = { id: 1, nickname: 'tester' };
    const onSelectChatRoom = vi.fn();

    getAllActiveChatRoomsMock
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce([]);

    render(<ChatRoomList user={user} onSelectChatRoom={onSelectChatRoom} />);

    expect(
      await screen.findByText('채팅방 목록을 불러오는데 실패했습니다.')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => {
      expect(getAllActiveChatRoomsMock).toHaveBeenCalledTimes(2);
    });

    expect(
      await screen.findByText('채팅방이 없습니다')
    ).toBeInTheDocument();
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
