import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CreateChatRoomModal from '../CreateChatRoomModal';

const createChatRoomMock = vi.fn();

vi.mock('../../api/chatRoomService', () => ({
  chatRoomService: {
    createChatRoom: (...args) => createChatRoomMock(...args),
  },
}));

describe('CreateChatRoomModal', () => {
  beforeEach(() => {
    createChatRoomMock.mockReset();
  });

  it('이름만 입력해 채팅방 생성 성공 시 onChatRoomCreated 호출 및 모달 닫힘', async () => {
    const onClose = vi.fn();
    const onChatRoomCreated = vi.fn();
    const user = { id: 7, nickname: 'tester' };
    const room = { id: 12, name: 'QA Room' };

    createChatRoomMock.mockResolvedValue(room);

    render(
      <CreateChatRoomModal
        user={user}
        onClose={onClose}
        onChatRoomCreated={onChatRoomCreated}
      />
    );

    await userEvent.type(screen.getByLabelText('채팅방 이름 *'), room.name);
    await userEvent.click(screen.getByRole('button', { name: '생성' }));

    await waitFor(() => {
      expect(onChatRoomCreated).toHaveBeenCalledWith(room);
    });

    expect(onClose).toHaveBeenCalled();
    // imageFile 미첨부 시 null로 호출
    expect(createChatRoomMock).toHaveBeenCalledWith(room.name, user.id, null);
  });

  it('설명 입력 필드가 존재하지 않는다', () => {
    const user = { id: 1, nickname: 'tester' };

    render(
      <CreateChatRoomModal
        user={user}
        onClose={vi.fn()}
        onChatRoomCreated={vi.fn()}
      />
    );

    expect(screen.queryByLabelText(/설명/)).toBeNull();
  });

  it('이미지 파일 입력 필드가 존재한다', () => {
    const user = { id: 1, nickname: 'tester' };

    render(
      <CreateChatRoomModal
        user={user}
        onClose={vi.fn()}
        onChatRoomCreated={vi.fn()}
      />
    );

    expect(screen.getByText('채팅방 이미지 (선택)')).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeNull();
  });
});
