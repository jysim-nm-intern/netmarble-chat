import api from './axiosConfig';

/**
 * 채팅방 관련 API 서비스
 * userId/creatorId는 서버가 세션에서 추출하므로 클라이언트에서 전달하지 않는다.
 */
export const chatRoomService = {
  /**
   * 채팅방 생성 (multipart/form-data)
   * @param {string} name - 채팅방 이름
   * @param {File|null} imageFile - 채팅방 썸네일 이미지 (선택)
   */
  createChatRoom: async (name, imageFile = null) => {
    try {
      const formData = new FormData();
      formData.append('name', name);
      if (imageFile) {
        formData.append('image', imageFile);
      }
      const response = await api.post('/chat-rooms', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 활성 채팅방 목록 조회 (읽지 않은 메시지 개수 포함)
   */
  getAllActiveChatRooms: async () => {
    try {
      const response = await api.get('/chat-rooms', {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 채팅방 상세 조회
   */
  getChatRoomById: async (id) => {
    try {
      const response = await api.get(`/chat-rooms/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 채팅방 입장
   */
  joinChatRoom: async (chatRoomId) => {
    try {
      const response = await api.post(`/chat-rooms/${chatRoomId}/join`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 채팅방 퇴장
   */
  leaveChatRoom: async (chatRoomId) => {
    try {
      await api.post(`/chat-rooms/${chatRoomId}/leave`);
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 채팅방 멤버 목록 조회
   */
  getChatRoomMembers: async (chatRoomId) => {
    try {
      const response = await api.get(`/chat-rooms/${chatRoomId}/members`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};
