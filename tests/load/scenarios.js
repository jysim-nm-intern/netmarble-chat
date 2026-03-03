/**
 * 통합 시나리오 부하테스트 (k6)
 *
 * REST API와 WebSocket/STOMP를 동시에 실행하여 실제 사용 패턴을 시뮬레이션합니다.
 *
 *  - rest_users  : REST API 전용 (방 목록 조회, 입장, 메시지 이력)
 *  - ws_chatters : WebSocket 채팅 (실시간 메시지 전송)
 *
 * 실행:
 *   k6 run tests/load/scenarios.js
 *   k6 run --out csv=tests/load/results/metrics.csv tests/load/scenarios.js
 */

import http from 'k6/http';
import ws   from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { API_URL, WS_URL, THRESHOLDS } from './config.js';

const totalErrors    = new Counter('total_errors');
const overallSuccess = new Rate('overall_success_rate');

export const options = {
  scenarios: {
    rest_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m',  target: 50 },
        { duration: '2m',  target: 50 },
        { duration: '30s', target: 0 },
      ],
      exec: 'restUserScenario',
      gracefulRampDown: '10s',
    },
    ws_chatters: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m',  target: 30 },
        { duration: '2m',  target: 30 },
        { duration: '30s', target: 0 },
      ],
      exec: 'wsChatterScenario',
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    ...THRESHOLDS,
    total_errors:         ['count<50'],
    overall_success_rate: ['rate>0.98'],
  },
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ─────────────────────────────────────────
// 공통 유틸
// ─────────────────────────────────────────
function createUser() {
  const res = http.post(
    `${API_URL}/users`,
    JSON.stringify({ nickname: `sc_user_${__VU}_${__ITER}` }),
    { headers: JSON_HEADERS },
  );
  if (res.status < 200 || res.status >= 300) return null;
  return res.json().id || null;
}

function createRoom(userId) {
  const res = http.post(
    `${API_URL}/chat-rooms`,
    JSON.stringify({ name: `sc_room_${__VU}_${__ITER}`, creatorId: userId }),
    { headers: JSON_HEADERS },
  );
  if (res.status < 200 || res.status >= 300) return null;
  return res.json().id || null;
}

function joinRoom(roomId, userId) {
  const res = http.post(
    `${API_URL}/chat-rooms/${roomId}/join?userId=${userId}`,
    null,
    { headers: JSON_HEADERS },
  );
  return res.status === 200;
}

// ─────────────────────────────────────────
// STOMP 프레임 유틸
// ─────────────────────────────────────────
function stompFrame(command, headers, body = '') {
  let frame = command + '\n';
  for (const [k, v] of Object.entries(headers)) {
    frame += `${k}:${v}\n`;
  }
  return frame + '\n' + body + '\0';
}

// ─────────────────────────────────────────
// 시나리오 1: REST 전용 유저
// ─────────────────────────────────────────
export function restUserScenario() {
  const userId = createUser();
  if (!userId) { totalErrors.add(1); sleep(1); return; }

  group('방 목록 조회', () => {
    const res = http.get(`${API_URL}/chat-rooms?userId=${userId}`);
    const ok = check(res, { '목록 200': (r) => r.status === 200 });
    overallSuccess.add(ok);
    if (!ok) totalErrors.add(1);
  });

  const roomId = createRoom(userId);
  if (!roomId) { totalErrors.add(1); sleep(1); return; }

  group('방 입장 + 메시지 이력', () => {
    const ok1 = joinRoom(roomId, userId);
    check(ok1, { '입장 성공': (v) => v === true });
    overallSuccess.add(ok1);
    if (!ok1) { totalErrors.add(1); return; }

    const msgRes = http.get(`${API_URL}/messages/chatroom/${roomId}`);
    const ok2 = check(msgRes, { '이력 200': (r) => r.status === 200 });
    overallSuccess.add(ok2);
    if (!ok2) totalErrors.add(1);
  });

  group('방 퇴장', () => {
    const res = http.post(
      `${API_URL}/chat-rooms/${roomId}/leave?userId=${userId}`,
      null,
      { headers: JSON_HEADERS },
    );
    const ok = check(res, { '퇴장 204': (r) => r.status === 204 });
    overallSuccess.add(ok);
    if (!ok) totalErrors.add(1);
  });

  sleep(2);
}

// ─────────────────────────────────────────
// 시나리오 2: WebSocket 채팅 유저
// ─────────────────────────────────────────
export function wsChatterScenario() {
  const userId = createUser();
  const roomId = createRoom(userId);
  if (!userId || !roomId) { totalErrors.add(1); sleep(1); return; }

  if (!joinRoom(roomId, userId)) { totalErrors.add(1); sleep(1); return; }

  group('WebSocket 채팅', () => {
    let connected = false;
    let sent = 0;

    const res = ws.connect(WS_URL, {}, (socket) => {
      socket.on('open', () => {
        socket.send(stompFrame('CONNECT', {
          'accept-version': '1.2',
          'heart-beat': '0,0',
          host: 'localhost',
        }));
      });

      socket.on('message', (data) => {
        const cmd = (data.split('\n')[0] || '').trim();

        if (cmd === 'CONNECTED') {
          connected = true;
          socket.send(stompFrame('SUBSCRIBE', {
            id: 'sub-0',
            destination: `/topic/room/${roomId}`,
            ack: 'auto',
          }));

          let cnt = 0;
          const tick = () => {
            if (cnt >= 3) {
              socket.send(stompFrame('DISCONNECT', { receipt: 'bye' }));
              socket.close();
              return;
            }
            socket.send(stompFrame(
              'SEND',
              { destination: '/app/chat.message', 'content-type': 'application/json' },
              JSON.stringify({
                roomId, userId,
                messageType: 'TEXT',
                content: `통합테스트 ${cnt + 1} VU${__VU}`,
                attachmentUrl: null,
              }),
            ));
            sent++;
            cnt++;
            socket.setTimeout(tick, 300);
          };
          socket.setTimeout(tick, 200);
        }

        if (cmd === 'ERROR') {
          totalErrors.add(1);
          socket.close();
        }
      });

      socket.on('error', () => { totalErrors.add(1); });
      socket.setTimeout(() => socket.close(), 10000);
    });

    const ok = check(res, { 'WS 101': (r) => r && r.status === 101 }) && connected;
    overallSuccess.add(ok);
    if (!ok) totalErrors.add(1);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests/load/results/scenarios-summary.json': JSON.stringify(data, null, 2),
    stdout: '\n=== 부하테스트 완료 ===\n결과: tests/load/results/scenarios-summary.json\n',
  };
}
