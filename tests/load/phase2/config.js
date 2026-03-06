export const CHAT_SERVER = __ENV.CHAT_SERVER || 'http://localhost:8080';
export const API_SERVER = __ENV.API_SERVER || 'http://localhost:8081';
export const CHAT_API = `${CHAT_SERVER}/api`;
export const API_API = `${API_SERVER}/api`;
export const WS_URL = __ENV.WS_URL || 'ws://localhost:8080/ws-stomp';
