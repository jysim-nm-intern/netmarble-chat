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
      await screen.findByText('아직 채팅방이 없습니다')
    ).toBeInTheDocument();
  });
});
