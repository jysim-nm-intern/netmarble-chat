/**
 * Phase 3 — 다중 인스턴스 로드밸런싱 검증
 *
 * Nginx를 통해 chat-server-1/2로 요청이 분산되는지 확인하고,
 * 크로스 인스턴스 간 데이터 일관성 검증.
 *
 * 시나리오:
 *   - VU 0 → 200 → 500 → 1000 → 1500 → 0
 *   - 채팅방 10개에 분산 배치
 *   - 유저 사전 생성 (setup) → 입장 → 메시지 조회(api-server) → 체류 → 퇴장
 *   - X-Upstream-Server 헤더로 분산 여부 확인
 *
 * 실행:
 *   k6 run tests/load/phase3/multi-instance-lb.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { NGINX_API, API_API, FORM_HEADERS } from './config.js';

const connErrors = new Counter('connection_errors');
const apiSuccess = new Rate('api_success_rate');
const joinDuration = new Trend('join_duration', true);
const queryDuration = new Trend('msg_query_api_server', true);
const server1Hits = new Counter('upstream_server_1');
const server2Hits = new Counter('upstream_server_2');

const NUM_ROOMS = 10;
const MAX_VUS = 1500;

export const options = {
  stages: [
    { duration: '30s', target: 200 },
    { duration: '30s', target: 500 },
    { duration: '1m', target: 1000 },
    { duration: '1m', target: 1500 },
    { duration: '2m', target: 1500 },
    { duration: '30s', target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<5000'],
    'http_req_duration{type:join}': ['p(95)<3000'],
    'msg_query_api_server': ['p(95)<500'],
    api_success_rate: ['rate>0.95'],
    connection_errors: ['count<100'],
  },
};

export function setup() {
  // 유저 사전 생성 (MAX_VUS만큼)
  const users = [];
  for (let i = 0; i < MAX_VUS; i++) {
    const res = http.post(`${NGINX_API}/users`, `nickname=p3lb_${i}_${Date.now()}`, {
      headers: FORM_HEADERS,
    });
    if (res.status >= 200 && res.status < 300) {
      users.push(JSON.parse(res.body).id);
    }
    // 대량 생성 시 서버 부하 분산
    if (i % 100 === 99) sleep(0.5);
  }
  console.log(`[setup] 유저 ${users.length}명 사전 생성 완료`);

  // 채팅방 생성
  const rooms = [];
  const creatorId = users[0];
  for (let i = 0; i < NUM_ROOMS; i++) {
    const res = http.post(`${NGINX_API}/chat-rooms`,
      `name=P3LBRoom_${i}_${Date.now()}&creatorId=${creatorId}`, {
        headers: FORM_HEADERS,
      });
    const room = JSON.parse(res.body);
    rooms.push(room.roomId || room.id);
  }
  console.log(`[setup] 방 ${rooms.length}개 생성 완료`);

  return { rooms, users };
}

export default function (data) {
  const vuIdx = (__VU - 1) % data.users.length;
  const userId = data.users[vuIdx];
  const roomIdx = __VU % NUM_ROOMS;
  const roomId = data.rooms[roomIdx];

  if (!userId) { connErrors.add(1); return; }

  // 1) upstream 서버 식별 (간단한 GET으로 확인)
  const healthRes = http.get(`${NGINX_API}/chat-rooms?userId=${userId}`);
  const upstream = healthRes.headers['X-Upstream-Server'] || '';
  if (upstream.includes('chat-server-1')) server1Hits.add(1);
  else if (upstream.includes('chat-server-2')) server2Hits.add(1);

  // 2) 채팅방 입장
  const joinRes = http.post(`${NGINX_API}/chat-rooms/${roomId}/join?userId=${userId}`, null, {
    tags: { type: 'join' },
  });
  const joinOk = check(joinRes, { 'joined room': (r) => r.status === 200 });
  apiSuccess.add(joinOk);
  joinDuration.add(joinRes.timings.duration);
  if (!joinOk) { connErrors.add(1); }

  // 3) 메시지 이력 조회 (api-server)
  const msgRes = http.get(`${API_API}/rooms/${roomId}/messages?limit=50`);
  const msgOk = check(msgRes, { 'messages loaded': (r) => r.status === 200 });
  apiSuccess.add(msgOk);
  queryDuration.add(msgRes.timings.duration);

  // 4) 활동 시뮬레이션
  sleep(Math.random() * 3 + 2);

  // 5) 채팅방 목록 조회
  const listRes = http.get(`${NGINX_API}/chat-rooms?userId=${userId}`);
  check(listRes, { 'room list': (r) => r.status === 200 });
  apiSuccess.add(check(listRes, { 'list ok': (r) => r.status === 200 }));

  sleep(Math.random() * 2 + 1);

  // 6) 퇴장
  http.post(`${NGINX_API}/chat-rooms/${roomId}/leave?userId=${userId}`);
}

export function handleSummary(data) {
  return {
    'tests/load/phase3/results/multi-instance-lb-summary.json': JSON.stringify(data, null, 2),
    stdout: '\n=== Phase 3 다중 인스턴스 LB 테스트 완료 ===\n',
  };
}
