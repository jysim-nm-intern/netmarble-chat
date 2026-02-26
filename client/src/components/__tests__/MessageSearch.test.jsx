import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageSearch from '../MessageSearch';
import { messageService } from '../../api/messageService';

// messageService 모킹
vi.mock('../../api/messageService', () => ({
  messageService: {
    searchMessages: vi.fn()
  }
}));

describe('MessageSearch Component', () => {
  const mockOnSearchResults = vi.fn();
  const mockOnClose = vi.fn();
  const chatRoomId = 1;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders search input field and close button', () => {
    render(
      <MessageSearch
        chatRoomId={chatRoomId}
        onSearchResults={mockOnSearchResults}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByPlaceholderText('검색...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검색 닫기' })).toBeInTheDocument();
  });

  test('searches messages successfully with results', async () => {
    const mockResults = [
      {
        id: 1,
        content: 'hello world',
        senderNickname: 'alice',
        sentAt: new Date().toISOString(),
        unreadCount: 0
      },
      {
        id: 2,
        content: 'hello everyone',
        senderNickname: 'bob',
        sentAt: new Date().toISOString(),
        unreadCount: 1
      }
    ];

    messageService.searchMessages.mockResolvedValue(mockResults);

    render(
      <MessageSearch
        chatRoomId={chatRoomId}
        onSearchResults={mockOnSearchResults}
        onClose={mockOnClose}
      />
    );

    const searchInput = screen.getByPlaceholderText('검색...');
    await userEvent.type(searchInput, 'hello');
    fireEvent.submit(searchInput.closest('form'));

    await waitFor(() => {
      expect(messageService.searchMessages).toHaveBeenCalledWith(chatRoomId, 'hello');
      expect(mockOnSearchResults).toHaveBeenCalledWith(mockResults);
      // 결과 건수 표시 (N건 형식)
      expect(screen.getByText('2건')).toBeInTheDocument();
    });
  });

  test('shows error when search keyword is empty', async () => {
    render(
      <MessageSearch
        chatRoomId={chatRoomId}
        onSearchResults={mockOnSearchResults}
        onClose={mockOnClose}
      />
    );

    const searchInput = screen.getByPlaceholderText('검색...');
    fireEvent.submit(searchInput.closest('form'));

    await waitFor(() => {
      expect(screen.getByText('검색어를 입력해주세요.')).toBeInTheDocument();
      expect(messageService.searchMessages).not.toHaveBeenCalled();
    });
  });

  test('shows no results message when search returns empty array', async () => {
    messageService.searchMessages.mockResolvedValue([]);

    render(
      <MessageSearch
        chatRoomId={chatRoomId}
        onSearchResults={mockOnSearchResults}
        onClose={mockOnClose}
      />
    );

    const searchInput = screen.getByPlaceholderText('검색...');
    await userEvent.type(searchInput, 'nonexistent');
    fireEvent.submit(searchInput.closest('form'));

    await waitFor(() => {
      expect(screen.getByText('검색 결과 없음')).toBeInTheDocument();
    });
  });

  test('handles search error gracefully', async () => {
    messageService.searchMessages.mockRejectedValue(new Error('API Error'));

    render(
      <MessageSearch
        chatRoomId={chatRoomId}
        onSearchResults={mockOnSearchResults}
        onClose={mockOnClose}
      />
    );

    const searchInput = screen.getByPlaceholderText('검색...');
    await userEvent.type(searchInput, 'hello');
    fireEvent.submit(searchInput.closest('form'));

    await waitFor(() => {
      expect(screen.getByText('메시지 검색 중 오류가 발생했습니다.')).toBeInTheDocument();
    });
  });

  test('clears input when clear button is clicked', async () => {
    render(
      <MessageSearch
        chatRoomId={chatRoomId}
        onSearchResults={mockOnSearchResults}
        onClose={mockOnClose}
      />
    );

    const searchInput = screen.getByPlaceholderText('검색...');
    await userEvent.type(searchInput, 'hello');

    // 검색어 입력 후 X(지우기) 버튼 표시됨
    const clearButton = screen.getByRole('button', { name: '검색어 지우기' });
    fireEvent.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  test('closes search component when close button is clicked', () => {
    render(
      <MessageSearch
        chatRoomId={chatRoomId}
        onSearchResults={mockOnSearchResults}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: '검색 닫기' });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('trims whitespace from search keyword', async () => {
    const mockResults = [];
    messageService.searchMessages.mockResolvedValue(mockResults);

    render(
      <MessageSearch
        chatRoomId={chatRoomId}
        onSearchResults={mockOnSearchResults}
        onClose={mockOnClose}
      />
    );

    const searchInput = screen.getByPlaceholderText('검색...');
    await userEvent.type(searchInput, '  hello  ');
    fireEvent.submit(searchInput.closest('form'));

    await waitFor(() => {
      expect(messageService.searchMessages).toHaveBeenCalledWith(chatRoomId, 'hello');
    });
  });

  test('shows loading state while searching', async () => {
    messageService.searchMessages.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([]), 100))
    );

    render(
      <MessageSearch
        chatRoomId={chatRoomId}
        onSearchResults={mockOnSearchResults}
        onClose={mockOnClose}
      />
    );

    const searchInput = screen.getByPlaceholderText('검색...');
    await userEvent.type(searchInput, 'hello');
    fireEvent.submit(searchInput.closest('form'));

    // 검색 중 스피너 텍스트 표시
    expect(screen.getByText('검색 중...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('검색 중...')).not.toBeInTheDocument();
    });
  });

  test('displays search results count correctly', async () => {
    const mockResults = [
      {
        id: 1,
        content: 'hello world',
        senderNickname: 'alice',
        sentAt: new Date().toISOString(),
        unreadCount: 3
      }
    ];

    messageService.searchMessages.mockResolvedValue(mockResults);

    render(
      <MessageSearch
        chatRoomId={chatRoomId}
        onSearchResults={mockOnSearchResults}
        onClose={mockOnClose}
      />
    );

    const searchInput = screen.getByPlaceholderText('검색...');
    await userEvent.type(searchInput, 'hello');
    fireEvent.submit(searchInput.closest('form'));

    await waitFor(() => {
      expect(screen.getByText('1건')).toBeInTheDocument();
    });
  });
});
