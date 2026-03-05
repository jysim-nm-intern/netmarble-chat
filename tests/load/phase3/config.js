/**
 * Phase 3 부하테스트 공통 설정
 * 아키텍처: Nginx(8888) → chat-server-1/2 + RabbitMQ STOMP Relay
 */

// Nginx 리버스 프록시 (scale 모드 진입점)
export const NGINX_URL = __ENV.NGINX_URL || 'http://localhost:8888';
export const NGINX_API = `${NGINX_URL}/api`;
export const NGINX_WS = __ENV.NGINX_WS || 'ws://localhost:8888/ws-stomp';

// api-server (MongoDB 메시지 조회 전용)
export const API_SERVER = __ENV.API_SERVER || 'http://localhost:8081';
export const API_API = `${API_SERVER}/api`;

export const JSON_HEADERS = { 'Content-Type': 'application/json' };
export const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' };
