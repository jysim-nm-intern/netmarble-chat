import api from './axiosConfig';

/**
 * 활성 상태 관리 서비스
 * userId는 서버가 세션에서 추출하므로 클라이언트에서 전달하지 않는다.
 */
export const activityService = {
  /**
   * 활성 상태 업데이트 (온라인/오프라인)
   */
  updateActiveStatus: async (chatRoomId, online) => {
    try {
      await api.put(`/chat-rooms/${chatRoomId}/members/status`, {
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
  sendHeartbeat: async (chatRoomId) => {
    try {
      await api.post(`/chat-rooms/${chatRoomId}/members/heartbeat`);
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }
};
