import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import Login from '../Login';

const createUserMock = vi.fn();

vi.mock('../../api/userService', () => ({
  userService: {
    createUser: (...args) => createUserMock(...args),
  },
}));

describe('Login', () => {
  beforeEach(() => {
    createUserMock.mockReset();
    localStorage.clear();
  });

  it('shows validation error for short nickname', async () => {
    render(<Login onLoginSuccess={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('닉네임'), 'a');
    await userEvent.click(screen.getByRole('button', { name: '채팅 시작' }));

    expect(
      await screen.findByText('닉네임은 2자 이상이어야 합니다.')
    ).toBeInTheDocument();
  });

  it('calls onLoginSuccess and stores user on success', async () => {
    const onLoginSuccess = vi.fn();
    const user = { id: 1, nickname: 'tester' };
    createUserMock.mockResolvedValue(user);

    render(<Login onLoginSuccess={onLoginSuccess} />);

    await userEvent.type(screen.getByLabelText('닉네임'), user.nickname);
    await userEvent.click(screen.getByRole('button', { name: '채팅 시작' }));

    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalledWith(user);
    });

    expect(JSON.parse(localStorage.getItem('chatUser'))).toEqual(user);
  });
});
