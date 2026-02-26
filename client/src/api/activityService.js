import api from './axiosConfig';

/**
 * 활성 상태 관리 서비스
 */
export const activityService = {
  /**
   * 활성 상태 업데이트 (온라인/오프라인)
   */
  updateActiveStatus: async (chatRoomId, userId, online) => {
    try {
      await api.put(`/chat-rooms/${chatRoomId}/members/status`, {
        userId,
        chatRoomId,
        online
      });
    } catch (error) {
      console.error('Failed to update active status:', error);
    }
  },

  /**
   * 하트비트 전송 (활동 업데이트)
   */
  sendHeartbeat: async (chatRoomId, userId) => {
    try {
      await api.post(`/chat-rooms/${chatRoomId}/members/heartbeat?userId=${userId}`);
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }
};
