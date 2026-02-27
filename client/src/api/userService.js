import api from './axiosConfig';

/**
 * 사용자 관련 API 서비스
 */
export const userService = {
  /**
   * 새로운 사용자 생성 / 로그인 (multipart/form-data)
   * @param {string} nickname
   * @param {string} profileColor - hex 색상 코드
   * @param {File|null} imageFile - 프로필 이미지 파일 (선택)
   */
  createUser: async (nickname, profileColor, imageFile = null) => {
    try {
      const formData = new FormData();
      formData.append('nickname', nickname);
      if (profileColor) formData.append('profileColor', profileColor);
      if (imageFile) formData.append('image', imageFile);
      const response = await api.post('/users', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 사용자 ID로 조회
   */
  getUserById: async (id) => {
    try {
      const response = await api.get(`/users/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 닉네임으로 사용자 조회
   */
  getUserByNickname: async (nickname) => {
    try {
      const response = await api.get(`/users/nickname/${nickname}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 활성 사용자 목록 조회
   */
  getActiveUsers: async () => {
    try {
      const response = await api.get('/users/active');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 닉네임 사용 가능 여부 확인
   */
  checkNicknameAvailability: async (nickname) => {
    try {
      const response = await api.get('/users/check-nickname', {
        params: { nickname }
      });
      return response.data.available;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * 사용자 활동 시간 업데이트
   */
  updateUserActivity: async (id) => {
    try {
      await api.put(`/users/${id}/activity`);
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};
