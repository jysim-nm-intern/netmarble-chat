import axios from 'axios';

// 개발: 8080 직접 호출 (프록시 우회, CORS 사용)
// 빌드/배포: /api (같은 오리진 또는 리버스 프록시)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // 세션 쿠키(JSESSIONID)를 크로스-오리진 요청에 포함
  withCredentials: true,
});

// 요청 인터셉터
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// 응답 인터셉터
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // 401 — 세션 만료 또는 미인증: 로컬 스토리지를 지우고 로그인 페이지로 이동
      if (error.response.status === 401) {
        localStorage.removeItem('chatUser');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      console.error('API Error:', error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;
