import api from './axiosConfig';

/**
 * 메시지 관련 API 서비스
 * senderId/userId는 서버가 세션에서 추출하므로 클라이언트에서 전달하지 않는다.
 */
export const messageService = {
  /**
   * 채팅방의 메시지 목록 조회
   * 세션 userId 기준의 입장 시점 이후 메시지만 반환된다.
   */
  getChatRoomMessages: async (chatRoomId) => {
    try {
      const response = await api.get(`/messages/chatroom/${chatRoomId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 메시지 ID로 조회
   */
  getMessageById: async (id) => {
    try {
      const response = await api.get(`/messages/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 메시지 삭제
   */
  deleteMessage: async (messageId) => {
    try {
      await api.delete(`/messages/${messageId}`);
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 메시지 검색
   * @param chatRoomId 채팅방 ID
   * @param keyword 검색 키워드
   * @returns 검색된 메시지 목록
   */
  searchMessages: async (chatRoomId, keyword) => {
    try {
      const response = await api.get(`/chat-rooms/${chatRoomId}/messages/search`, {
        params: { keyword }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 스티커 전송
   * @param chatRoomId 채팅방 ID
   * @param sticker 스티커 텍스트/이모지
   * @returns 전송된 메시지
   */
  sendSticker: async (chatRoomId, sticker) => {
    try {
      const response = await api.post(`/chat-rooms/${chatRoomId}/messages`, {
        chatRoomId: chatRoomId,
        content: sticker,
        messageType: 'STICKER',
        timestamp: new Date().toISOString()
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 이미지 업로드 및 전송
   * @param chatRoomId 채팅방 ID
   * @param imageData Base64 인코딩된 이미지 데이터
   * @param fileName 파일명
   * @returns 전송된 메시지
   */
  sendImage: async (chatRoomId, imageData, fileName) => {
    try {
      const response = await api.post(`/chat-rooms/${chatRoomId}/messages`, {
        chatRoomId: chatRoomId,
        content: imageData,
        messageType: 'IMAGE',
        fileName: fileName,
        timestamp: new Date().toISOString()
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 이미지를 단일 multipart 요청으로 업로드 (대용량 파일용)
   * @param chatRoomId 채팅방 ID
   * @param file 파일 객체
   * @returns 전송된 메시지
   */
  uploadImageFile: async (chatRoomId, file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/chat-rooms/${chatRoomId}/messages/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};
