/**
 * 8.4 — 1,000명 동시 접속 시뮬레이션
 *
 * 시나리오:
 *   - 채팅방 10개에 VU를 분산 배치
 *   - 각 VU: 유저 생성 → 채팅방 입장 → 메시지 이력 조회(api-server) → 체류 → 퇴장
 *   - VU 0 → 200 → 500 → 1000 → 500 → 0 단계별 증가
 *
 * 실행:
 *   k6 run tests/load/phase2/concurrent-connections.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { CHAT_API, API_API } from './config.js';

const connErrors = new Counter('connection_errors');
const apiSuccess = new Rate('api_success_rate');
const joinDuration = new Trend('join_duration', true);
const queryDuration = new Trend('msg_query_api_server', true);

const NUM_ROOMS = 10;

export const options = {
  stages: [
    { duration: '30s', target: 200 },
    { duration: '1m', target: 500 },
    { duration: '1m', target: 1000 },
    { duration: '2m', target: 1000 },
    { duration: '30s', target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
    'http_req_duration{type:join}': ['p(95)<2000'],
    'msg_query_api_server': ['p(95)<500'],
    api_success_rate: ['rate>0.95'],
    connection_errors: ['count<50'],
  },
};

export function setup() {
  const rooms = [];
  const creator = http.post(`${CHAT_API}/users`, 'nickname=loadtest_creator_cc', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const creatorId = JSON.parse(creator.body).id;

  for (let i = 0; i < NUM_ROOMS; i++) {
    const res = http.post(`${CHAT_API}/chat-rooms`,
      `name=ConcRoom_${i}_${Date.now()}&creatorId=${creatorId}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    const room = JSON.parse(res.body);
    rooms.push(room.roomId || room.id);
  }
  return { rooms, creatorId };
}

export default function (data) {
  const vuId = __VU;
  const roomIdx = vuId % NUM_ROOMS;
  const roomId = data.rooms[roomIdx];
  const nick = `vu_${vuId}_${__ITER}`;

  // 1) 유저 생성 (chat-server)
  const userRes = http.post(`${CHAT_API}/users`, `nickname=${nick}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const userOk = check(userRes, {
    'user created': (r) => r.status === 200 || r.status === 201,
  });
  apiSuccess.add(userOk);
  if (!userOk) { connErrors.add(1); return; }

  const userId = JSON.parse(userRes.body).id;

  // 2) 채팅방 입장 (chat-server)
  const joinRes = http.post(`${CHAT_API}/chat-rooms/${roomId}/join?userId=${userId}`, null, {
    tags: { type: 'join' },
  });
  const joinOk = check(joinRes, { 'joined room': (r) => r.status === 200 });
  apiSuccess.add(joinOk);
  joinDuration.add(joinRes.timings.duration);
  if (!joinOk) { connErrors.add(1); }

  // 3) 메시지 이력 조회 (api-server 8081)
  const msgRes = http.get(`${API_API}/rooms/${roomId}/messages?limit=50`);
  const msgOk = check(msgRes, { 'messages loaded': (r) => r.status === 200 });
  apiSuccess.add(msgOk);
  queryDuration.add(msgRes.timings.duration);

  // 4) 활동 시뮬레이션 (체류)
  sleep(Math.random() * 3 + 2);

  // 5) 채팅방 목록 조회 (chat-server)
  const listRes = http.get(`${CHAT_API}/chat-rooms?userId=${userId}`);
  check(listRes, { 'room list': (r) => r.status === 200 });

  sleep(Math.random() * 2 + 1);

  // 6) 채팅방 퇴장 (chat-server)
  http.post(`${CHAT_API}/chat-rooms/${roomId}/leave?userId=${userId}`);
}
