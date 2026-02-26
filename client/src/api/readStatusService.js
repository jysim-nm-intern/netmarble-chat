import api from './axiosConfig';

/**
 * 읽음 상태 관련 API 서비스
 */
export const readStatusService = {
  /**
   * 메시지 읽음 처리
   */
  markAsRead: async (userId, chatRoomId) => {
    try {
      console.log('[READ STATUS] 읽음 처리 요청 - userId:', userId, ', chatRoomId:', chatRoomId);
      await api.post('/read-status/mark-read', null, {
        params: { userId, chatRoomId }
      });
      console.log('[READ STATUS] 읽음 처리 완료 - userId:', userId, ', chatRoomId:', chatRoomId);
    } catch (error) {
      console.error('[READ STATUS] 읽음 처리 실패:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * 특정 채팅방의 읽지 않은 메시지 개수
   */
  getUnreadCount: async (userId, chatRoomId) => {
    try {
      const response = await api.get('/read-status/unread-count', {
        params: { userId, chatRoomId }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 모든 채팅방의 읽지 않은 메시지 개수 (Map 형태)
   */
  getAllUnreadCounts: async (userId) => {
    try {
      const response = await api.get(`/read-status/unread-counts/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 활성 채팅방의 읽지 않은 메시지 개수 목록
   */
  getUnreadCountsList: async (userId) => {
    try {
      const response = await api.get(`/read-status/unread-counts-list/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};
