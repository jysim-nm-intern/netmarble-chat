/**
 * k6 부하테스트 공통 설정
 * - BASE_URL, WS_URL 등 환경 설정을 중앙에서 관리합니다.
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
export const API_URL = `${BASE_URL}/api`;
export const WS_URL = __ENV.WS_URL || 'ws://localhost:8080/ws-stomp';

// 공통 임계값 (성능 기준)
export const THRESHOLDS = {
  // HTTP 요청 실패율 1% 미만
  http_req_failed: ['rate<0.01'],
  // 95퍼센타일 응답시간 500ms 미만
  http_req_duration: ['p(95)<500'],
  // WebSocket 연결 실패율 1% 미만
  ws_connecting: ['p(95)<1000'],
};

// 단계별 부하 프로파일 (공통)
export const RAMP_UP_STAGES = [
  { duration: '30s', target: 10 },   // 30초 동안 10명까지 증가
  { duration: '1m',  target: 50 },   // 1분 동안 50명 유지
  { duration: '30s', target: 100 },  // 30초 동안 100명까지 증가
  { duration: '2m',  target: 100 },  // 2분 동안 100명 유지 (피크)
  { duration: '30s', target: 0 },    // 30초 동안 0명으로 감소
];

// 가벼운 스모크 테스트용 프로파일
export const SMOKE_STAGES = [
  { duration: '30s', target: 5 },
  { duration: '1m',  target: 5 },
  { duration: '10s', target: 0 },
];

// 스파이크 테스트용 프로파일
export const SPIKE_STAGES = [
  { duration: '10s', target: 10 },
  { duration: '10s', target: 200 },  // 급격한 부하 증가
  { duration: '1m',  target: 200 },
  { duration: '10s', target: 0 },
];
