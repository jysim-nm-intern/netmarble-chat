import { describe, test, expect, beforeEach, vi } from 'vitest';
import { messageService } from '../messageService';
import api from '../axiosConfig';

// axiosConfig 모킹
vi.mock('../axiosConfig', () => ({
  default: {
    get: vi.fn()
  }
}));

describe('messageService - searchMessages', () => {
  const chatRoomId = 1;
  const keyword = 'hello';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('searchMessages calls correct API endpoint with keyword parameter', async () => {
    const mockResponse = {
      data: [
        { id: 1, content: 'hello world', senderNickname: 'alice' },
        { id: 2, content: 'hello there', senderNickname: 'bob' }
      ]
    };

    api.get.mockResolvedValue(mockResponse);

    const result = await messageService.searchMessages(chatRoomId, keyword);

    expect(api.get).toHaveBeenCalledWith(
      `/chat-rooms/${chatRoomId}/messages/search`,
      { params: { keyword } }
    );
    expect(result).toEqual(mockResponse.data);
  });

  test('searchMessages returns empty array when no results found', async () => {
    const mockResponse = {
      data: []
    };

    api.get.mockResolvedValue(mockResponse);

    const result = await messageService.searchMessages(chatRoomId, keyword);

    expect(result).toEqual([]);
  });

  test('searchMessages throws error on API failure', async () => {
    const errorResponse = {
      data: { error: 'Invalid search keyword' }
    };

    const error = new Error('API Error');
    error.response = errorResponse;

    api.get.mockRejectedValue(error);

    await expect(messageService.searchMessages(chatRoomId, keyword))
      .rejects.toMatchObject(errorResponse.data);
  });

  test('searchMessages handles special characters in keyword', async () => {
    const specialKeyword = '$100';
    const mockResponse = {
      data: [
        { id: 1, content: 'price: $100', senderNickname: 'alice' }
      ]
    };

    api.get.mockResolvedValue(mockResponse);

    const result = await messageService.searchMessages(chatRoomId, specialKeyword);

    expect(api.get).toHaveBeenCalledWith(
      `/chat-rooms/${chatRoomId}/messages/search`,
      { params: { keyword: specialKeyword } }
    );
    expect(result).toEqual(mockResponse.data);
  });

  test('searchMessages includes all message fields in response', async () => {
    const mockResponse = {
      data: [
        {
          id: 1,
          chatRoomId: 1,
          senderId: 1,
          senderNickname: 'alice',
          content: 'hello world',
          type: 'TEXT',
          sentAt: '2026-02-22T10:30:00',
          deleted: false,
          unreadCount: 2
        }
      ]
    };

    api.get.mockResolvedValue(mockResponse);

    const result = await messageService.searchMessages(chatRoomId, keyword);

    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('chatRoomId');
    expect(result[0]).toHaveProperty('senderId');
    expect(result[0]).toHaveProperty('senderNickname');
    expect(result[0]).toHaveProperty('content');
    expect(result[0]).toHaveProperty('type');
    expect(result[0]).toHaveProperty('sentAt');
    expect(result[0]).toHaveProperty('deleted');
    expect(result[0]).toHaveProperty('unreadCount');
  });
});
