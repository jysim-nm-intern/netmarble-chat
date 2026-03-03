/**
 * 다중 채팅방 시스템 용량 스트레스 테스트
 *
 * 목적: 방당 고정 인원으로 방 수를 늘려 전체 시스템 용량 측정
 * 시나리오:
 *   - USERS_PER_ROOM = 50  고정
 *   - 방 수 2 → 4 → 8 → 12개로 증가 (총 VU: 100 → 200 → 400 → 600)
 *
 * 실행 시 환경변수로 방 수 조정 가능:
 *   k6 run -e ROOM_COUNT=10 tests/load/stress-multi-room.js
 */

import http from 'k6/http';
import ws   from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { API_URL, WS_URL } from './config.js';

const wsConnectErrors  = new Counter('ws_connect_errors');
const stompConnErrors  = new Counter('stomp_connect_errors');
const msgSentCount     = new Counter('stomp_messages_sent');
const msgReceivedCount = new Counter('stomp_messages_received');
const wsSessionDuration = new Trend('ws_session_duration_ms', true);
const wsSuccessRate    = new Rate('ws_success_rate');

const USERS_PER_ROOM = 50;
const ROOM_COUNT     = parseInt(__ENV.ROOM_COUNT || '8');
const TOTAL_VUS      = USERS_PER_ROOM * ROOM_COUNT;
const MSG_SEND_COUNT = 3;
const JSON_HEADERS   = { 'Content-Type': 'application/json' };

export const options = {
  stages: [
    { duration: '15s', target: Math.floor(TOTAL_VUS * 0.25) },
    { duration: '15s', target: Math.floor(TOTAL_VUS * 0.50) },
    { duration: '15s', target: TOTAL_VUS },
    { duration: '40s', target: TOTAL_VUS },  // 피크 유지
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    ws_connect_errors:       ['count<50'],
    stomp_connect_errors:    ['count<50'],
    ws_success_rate:         ['rate>0.80'],
    ws_session_duration_ms:  ['p(95)<15000'],
    stomp_messages_received: ['count>0'],
    http_req_failed:         ['rate<0.05'],
    http_req_duration:       ['p(95)<3000'],
  },
};

function stompFrame(command, headers, body = '') {
  let frame = command + '\n';
  for (const [k, v] of Object.entries(headers)) frame += `${k}:${v}\n`;
  return frame + '\n' + body + '\0';
}

export function setup() {
  const coordRes = http.post(
    `${API_URL}/users`,
    { nickname: 'multi_coord' },
  );
  const coordId = coordRes.json().id;

  const rooms = [];
  for (let i = 0; i < ROOM_COUNT; i++) {
    const roomRes = http.post(
      `${API_URL}/chat-rooms`,
      { name: `multi_room_${i}`, creatorId: coordId },
    );
    if (roomRes.status >= 200 && roomRes.status < 300) {
      const id = roomRes.json().id;
      if (id) rooms.push(id);
    }
  }
  if (rooms.length === 0) throw new Error('방 생성 실패');
  console.log(`[setup] 방 ${rooms.length}개 생성 (방당 ${USERS_PER_ROOM}명 목표, 총 VU: ${TOTAL_VUS}): ${rooms.join(', ')}`);
  return { rooms };
}

export default function ({ rooms }) {
  // VU 번호 기준으로 방 배정 (균등 분산)
  const roomId = rooms[(__VU - 1) % rooms.length];

  const userRes = http.post(
    `${API_URL}/users`,
    { nickname: `multi_u_${__VU}_${__ITER}` },
  );
  if (userRes.status < 200 || userRes.status >= 300) { wsConnectErrors.add(1); sleep(1); return; }
  const userId = userRes.json().id;
  if (!userId) { wsConnectErrors.add(1); sleep(1); return; }

  const joinRes = http.post(
    `${API_URL}/chat-rooms/${roomId}/join?userId=${userId}`,
    null,
    { headers: JSON_HEADERS },
  );
  if (joinRes.status !== 200) { wsConnectErrors.add(1); sleep(1); return; }

  const sessionStart = Date.now();
  let stompConnected = false;
  let sentCount = 0;
  let lastMsgId = null;

  const res = ws.connect(WS_URL, {}, (socket) => {
    socket.on('open', () => {
      socket.send(stompFrame('CONNECT', {
        'accept-version': '1.2,1.1',
        'heart-beat': '0,0',
        host: 'localhost',
      }));
    });

    socket.on('message', (raw) => {
      const cmd = (raw.split('\n')[0] || '').trim();

      if (cmd === 'CONNECTED') {
        stompConnected = true;
        socket.send(stompFrame('SUBSCRIBE', {
          id: 'sub-0',
          destination: `/topic/chatroom/${roomId}`,
          ack: 'auto',
        }));
        let cnt = 0;
        const sendNext = () => {
          if (cnt >= MSG_SEND_COUNT) {
            if (lastMsgId) {
              http.post(
                `${API_URL}/read-status/mark-read?userId=${userId}&chatRoomId=${roomId}`,
                null, { headers: JSON_HEADERS },
              );
            }
            socket.setTimeout(() => {
              socket.send(stompFrame('DISCONNECT', { receipt: 'dr' }));
              socket.close();
            }, 200);
            return;
          }
          socket.send(stompFrame(
            'SEND',
            { destination: '/app/chat.sendMessage', 'content-type': 'application/json' },
            JSON.stringify({ chatRoomId: roomId, senderId: userId, messageType: 'TEXT',
              content: `부하 ${cnt + 1} VU${__VU} room${roomId}` }),
          ));
          msgSentCount.add(1);
          sentCount++;
          cnt++;
          socket.setTimeout(sendNext, 300);
        };
        socket.setTimeout(sendNext, 200);
      }

      if (cmd === 'MESSAGE') {
        msgReceivedCount.add(1);
        try {
          const bi = raw.lastIndexOf('\n\n');
          if (bi !== -1) {
            const body = JSON.parse(raw.substring(bi + 2).replace('\0', ''));
            if (body.id) lastMsgId = body.id;
          }
        } catch (_) {}
      }

      if (cmd === 'ERROR') { stompConnErrors.add(1); socket.close(); }
    });

    socket.on('error', () => wsConnectErrors.add(1));
    socket.on('close', () => {
      wsSessionDuration.add(Date.now() - sessionStart);
      wsSuccessRate.add(stompConnected && sentCount > 0);
    });
    socket.setTimeout(() => { if (!stompConnected) stompConnErrors.add(1); socket.close(); }, 20000);
  });

  check(res, { 'WS 101': (r) => r && r.status === 101 });
  if (!res || res.status !== 101) wsConnectErrors.add(1);

  http.post(`${API_URL}/chat-rooms/${roomId}/leave?userId=${userId}`, null, { headers: JSON_HEADERS });
  sleep(1);
}

export function handleSummary(data) {
  const roomCount = data.setup_data ? data.setup_data.rooms.length : ROOM_COUNT;
  const filename = `tests/load/results/stress-multi-room-${roomCount}rooms-summary.json`;
  return {
    [filename]: JSON.stringify(data, null, 2),
    stdout: `\n=== 다중 방 스트레스 테스트 완료 (${roomCount}방 × ${USERS_PER_ROOM}명) ===\n결과: ${filename}\n`,
  };
}
