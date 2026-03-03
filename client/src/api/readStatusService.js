import api from './axiosConfig';

/**
 * 읽음 상태 관련 API 서비스
 * userId는 서버가 세션에서 추출하므로 클라이언트에서 전달하지 않는다.
 */
export const readStatusService = {
  /**
   * 메시지 읽음 처리
   */
  markAsRead: async (chatRoomId) => {
    try {
      console.log('[READ STATUS] 읽음 처리 요청 - chatRoomId:', chatRoomId);
      await api.post('/read-status/mark-read', null, {
        params: { chatRoomId }
      });
      console.log('[READ STATUS] 읽음 처리 완료 - chatRoomId:', chatRoomId);
    } catch (error) {
      console.error('[READ STATUS] 읽음 처리 실패:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * 특정 채팅방의 읽지 않은 메시지 개수
   */
  getUnreadCount: async (chatRoomId) => {
    try {
      const response = await api.get('/read-status/unread-count', {
        params: { chatRoomId }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 모든 채팅방의 읽지 않은 메시지 개수 (Map 형태)
   */
  getAllUnreadCounts: async () => {
    try {
      const response = await api.get('/read-status/unread-counts');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 활성 채팅방의 읽지 않은 메시지 개수 목록
   */
  getUnreadCountsList: async () => {
    try {
      const response = await api.get('/read-status/unread-counts-list');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};
