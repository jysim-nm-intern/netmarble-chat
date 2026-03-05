/**
 * Phase 3 — RabbitMQ STOMP 브로커 + 방당 500명 동시 접속 테스트
 *
 * Phase 2까지는 SimpleBroker로 인해 방당 200명이 한계였으나,
 * Phase 3에서 RabbitMQ STOMP Relay로 전환하여 방당 500명 목표 검증.
 *
 * 시나리오:
 *   - 유저 사전 생성 (setup) → 방 2개에 VU 분산 배치 (방당 최대 500명)
 *   - 각 VU: 입장 → WebSocket STOMP 연결 → 메시지 송수신 → 퇴장
 *   - Nginx(8888) 경유 → chat-server-1/2 로드밸런싱
 *
 * 실행:
 *   k6 run tests/load/phase3/stomp-rabbitmq.js
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { NGINX_API, NGINX_WS, FORM_HEADERS, JSON_HEADERS } from './config.js';

const wsConnectErrors = new Counter('ws_connect_errors');
const stompConnErrors = new Counter('stomp_connect_errors');
const msgSentCount = new Counter('stomp_messages_sent');
const msgReceivedCount = new Counter('stomp_messages_received');
const wsSessionDuration = new Trend('ws_session_duration_ms', true);
const wsSuccessRate = new Rate('ws_success_rate');

const SHARED_ROOM_COUNT = 2;
const MSG_SEND_COUNT = 5;
const MAX_VUS = 1000;

export const options = {
  stages: [
    { duration: '20s', target: 200 },
    { duration: '20s', target: 500 },
    { duration: '1m', target: 500 },   // 방당 250명 유지
    { duration: '30s', target: 1000 },  // 방당 500명 도달
    { duration: '1m', target: 1000 },   // 방당 500명 유지
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    ws_connect_errors: ['count<20'],
    stomp_connect_errors: ['count<20'],
    ws_success_rate: ['rate>0.95'],
    ws_session_duration_ms: ['p(95)<10000'],
    stomp_messages_received: ['count>0'],
  },
};

function stompFrame(command, headers, body = '') {
  let frame = command + '\n';
  for (const [k, v] of Object.entries(headers)) {
    frame += `${k}:${v}\n`;
  }
  frame += '\n' + body + '\0';
  return frame;
}

export function setup() {
  // 유저 사전 생성
  const users = [];
  for (let i = 0; i < MAX_VUS; i++) {
    const res = http.post(`${NGINX_API}/users`, `nickname=p3s_${i}_${Date.now()}`, {
      headers: FORM_HEADERS,
    });
    if (res.status >= 200 && res.status < 300) {
      users.push(JSON.parse(res.body).id);
    }
    if (i % 100 === 99) sleep(0.5);
  }
  console.log(`[setup] 유저 ${users.length}명 사전 생성 완료`);

  // 채팅방 생성
  const rooms = [];
  const coordId = users[0];
  for (let i = 0; i < SHARED_ROOM_COUNT; i++) {
    const res = http.post(`${NGINX_API}/chat-rooms`,
      `name=P3StompRoom_${i}_${Date.now()}&creatorId=${coordId}`, {
        headers: FORM_HEADERS,
      });
    const room = JSON.parse(res.body);
    rooms.push(room.roomId || room.id);
  }
  if (rooms.length === 0) throw new Error('방 생성 실패');
  console.log(`[setup] 방 ${rooms.length}개 생성 완료: ${rooms.join(', ')}`);

  return { rooms, users };
}

export default function (data) {
  const { rooms, users } = data;
  const vuIdx = (__VU - 1) % users.length;
  const userId = users[vuIdx];
  const roomId = rooms[(__VU - 1) % rooms.length];

  if (!userId) {
    wsConnectErrors.add(1);
    sleep(1);
    return;
  }

  // 채팅방 입장
  group('사전 준비 (REST via Nginx)', () => {
    const joinRes = http.post(
      `${NGINX_API}/chat-rooms/${roomId}/join?userId=${userId}`, null,
      { headers: JSON_HEADERS });
    check(joinRes, { '입장 성공': (r) => r.status === 200 });
  });

  group('WebSocket STOMP via RabbitMQ', () => {
    const sessionStart = Date.now();
    let stompConnected = false;
    let sentCount = 0;

    const res = ws.connect(NGINX_WS, {}, (socket) => {
      socket.on('open', () => {
        socket.send(stompFrame('CONNECT', {
          'accept-version': '1.2,1.1',
          'heart-beat': '10000,10000',
          host: '/',
        }));
      });

      socket.on('message', (rawData) => {
        const cmd = (rawData.split('\n')[0] || '').trim();

        if (cmd === 'CONNECTED') {
          stompConnected = true;

          socket.send(stompFrame('SUBSCRIBE', {
            id: 'sub-0',
            destination: `/topic/chatroom.${roomId}`,
            ack: 'auto',
          }));

          let cnt = 0;
          const sendNext = () => {
            if (cnt >= MSG_SEND_COUNT) {
              socket.setTimeout(() => {
                socket.send(stompFrame('DISCONNECT', { receipt: 'disc' }));
                socket.close();
              }, 300);
              return;
            }
            socket.send(stompFrame(
              'SEND',
              { destination: '/app/chat.sendMessage', 'content-type': 'application/json' },
              JSON.stringify({
                chatRoomId: roomId,
                senderId: userId,
                messageType: 'TEXT',
                content: `P3 STOMP ${cnt + 1} VU${__VU}`,
              }),
            ));
            msgSentCount.add(1);
            sentCount++;
            cnt++;
            socket.setTimeout(sendNext, 200);
          };
          socket.setTimeout(sendNext, 300);
        }

        if (cmd === 'MESSAGE') {
          msgReceivedCount.add(1);
        }

        if (cmd === 'ERROR') {
          stompConnErrors.add(1);
          socket.close();
        }
      });

      socket.on('error', () => { wsConnectErrors.add(1); });

      socket.on('close', () => {
        wsSessionDuration.add(Date.now() - sessionStart);
        const ok = stompConnected && sentCount > 0;
        wsSuccessRate.add(ok);
      });

      socket.setTimeout(() => {
        if (!stompConnected) stompConnErrors.add(1);
        socket.close();
      }, 15000);
    });

    check(res, { 'WebSocket 101': (r) => r && r.status === 101 });
    if (!res || res.status !== 101) wsConnectErrors.add(1);
  });

  http.post(`${NGINX_API}/chat-rooms/${roomId}/leave?userId=${userId}`, null, {
    headers: JSON_HEADERS,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests/load/phase3/results/stomp-rabbitmq-summary.json': JSON.stringify(data, null, 2),
    stdout: '\n=== Phase 3 STOMP RabbitMQ 테스트 완료 ===\n',
  };
}
