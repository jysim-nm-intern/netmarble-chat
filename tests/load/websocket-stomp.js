/**
 * WebSocket/STOMP 부하테스트 - 공유 방 시나리오 (k6)
 *
 * 테스트 시나리오:
 *   [setup] 공유 채팅방 10개 사전 생성
 *   [VU]  1. 사용자 생성 → 랜덤 공유 방 입장 (REST)
 *         2. WebSocket 연결 (/ws-stomp)
 *         3. STOMP CONNECT 핸드셰이크
 *         4. /topic/room/{roomId} 구독 (같은 방 다른 유저 메시지 수신)
 *         5. /app/chat.message 로 메시지 반복 전송 → 구독자 전체 브로드캐스트
 *         6. /app/chat.read 읽음 처리
 *         7. STOMP DISCONNECT → 방 퇴장
 *
 * 실행:
 *   k6 run tests/load/websocket-stomp.js
 */

import http from 'k6/http';
import ws   from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { API_URL, WS_URL, THRESHOLDS } from './config.js';

// 커스텀 메트릭
const wsConnectErrors   = new Counter('ws_connect_errors');
const stompConnErrors   = new Counter('stomp_connect_errors');
const msgSentCount      = new Counter('stomp_messages_sent');
const msgReceivedCount  = new Counter('stomp_messages_received');
const wsSessionDuration = new Trend('ws_session_duration_ms', true);
const wsSuccessRate     = new Rate('ws_success_rate');

// 공유 방 개수 (200 VU ÷ 2방 = 방당 100명 동시 채팅)
const SHARED_ROOM_COUNT = 2;
const MSG_SEND_COUNT    = 5;
const JSON_HEADERS      = { 'Content-Type': 'application/json' };

export const options = {
  stages: [
    { duration: '10s', target: 200 }, // 10초 만에 200 VU
    { duration: '40s', target: 200 }, // 40초 유지
    { duration: '10s', target: 0   }, // 10초 감소
  ],
  thresholds: {
    ...THRESHOLDS,
    ws_connect_errors:        ['count<10'],
    stomp_connect_errors:     ['count<10'],
    ws_success_rate:          ['rate>0.98'],
    ws_session_duration_ms:   ['p(95)<5000'],
    stomp_messages_received:  ['count>0'],
  },
};

// ─────────────────────────────────────────
// STOMP 프레임 유틸리티
// ─────────────────────────────────────────
function stompFrame(command, headers, body = '') {
  let frame = command + '\n';
  for (const [k, v] of Object.entries(headers)) {
    frame += `${k}:${v}\n`;
  }
  frame += '\n' + body + '\0';
  return frame;
}

// ─────────────────────────────────────────
// setup: 테스트 시작 전 공유 방 N개 생성 (1회 실행)
// ─────────────────────────────────────────
export function setup() {
  const coordRes = http.post(
    `${API_URL}/users`,
    { nickname: 'load_coordinator' },
  );
  if (coordRes.status < 200 || coordRes.status >= 300) {
    throw new Error(`코디네이터 유저 생성 실패: ${coordRes.status}`);
  }
  const coordId = coordRes.json().id;

  const rooms = [];
  for (let i = 0; i < SHARED_ROOM_COUNT; i++) {
    const roomRes = http.post(
      `${API_URL}/chat-rooms`,
      { name: `shared_room_${i}`, creatorId: coordId },
    );
    if (roomRes.status < 200 || roomRes.status >= 300) continue;
    const roomId = roomRes.json().id;
    if (roomId) rooms.push(roomId);
  }

  if (rooms.length === 0) throw new Error('공유 방 생성 실패');
  console.log(`[setup] 공유 방 ${rooms.length}개 생성 완료: ${rooms.join(', ')}`);
  return { rooms };
}

// ─────────────────────────────────────────
// REST 사전 준비: 사용자 생성 → 랜덤 공유 방 입장
// ─────────────────────────────────────────
function setupSession(rooms) {
  const userRes = http.post(
    `${API_URL}/users`,
    { nickname: `ws_user_${__VU}_${__ITER}` },
  );
  if (userRes.status < 200 || userRes.status >= 300) return null;
  const userId = userRes.json().id;
  if (!userId) return null;

  // 랜덤 공유 방 선택 (20명씩 분산)
  const roomId = rooms[(__VU - 1) % rooms.length];

  const joinRes = http.post(
    `${API_URL}/chat-rooms/${roomId}/join?userId=${userId}`,
    null,
    { headers: JSON_HEADERS },
  );
  if (joinRes.status !== 200) return null;

  return { userId, roomId };
}

// ─────────────────────────────────────────
// 메인 VU 시나리오
// ─────────────────────────────────────────
export default function (data) {
  const { rooms } = data;

  let session;
  group('사전 준비 (REST)', () => {
    session = setupSession(rooms);
    check(session, { '세션 생성 성공': (s) => s !== null });
  });

  if (!session) {
    wsConnectErrors.add(1);
    sleep(1);
    return;
  }

  const { userId, roomId } = session;

  group('WebSocket STOMP 세션', () => {
    const sessionStart = Date.now();
    let stompConnected = false;
    let lastMsgId      = null;
    let sentCount      = 0;

    const res = ws.connect(WS_URL, {}, (socket) => {
      socket.on('open', () => {
        socket.send(stompFrame('CONNECT', {
          'accept-version': '1.2,1.1',
          'heart-beat': '10000,10000',
          host: 'localhost',
        }));
      });

      socket.on('message', (rawData) => {
        const cmd = (rawData.split('\n')[0] || '').trim();

        if (cmd === 'CONNECTED') {
          stompConnected = true;
          check(cmd, { 'STOMP CONNECTED 수신': (c) => c === 'CONNECTED' });

          // 공유 방 구독 (다른 VU의 메시지도 여기서 수신됨)
          socket.send(stompFrame('SUBSCRIBE', {
            id: 'sub-0',
            destination: `/topic/chatroom/${roomId}`,
            ack: 'auto',
          }));

          // 메시지 반복 전송
          let cnt = 0;
          const sendNext = () => {
            if (cnt >= MSG_SEND_COUNT) {
              if (lastMsgId) {
                // 읽음 처리는 REST API로 (STOMP 핸들러 없음)
                http.post(
                  `${API_URL}/read-status/mark-read?userId=${userId}&chatRoomId=${roomId}`,
                  null,
                  { headers: JSON_HEADERS },
                );
              }
              socket.setTimeout(() => {
                socket.send(stompFrame('DISCONNECT', { receipt: 'disconnect-receipt' }));
                socket.close();
              }, 300);
              return;
            }
            socket.send(stompFrame(
              'SEND',
              { destination: '/app/chat.sendMessage', 'content-type': 'application/json' },
              JSON.stringify({
                chatRoomId: roomId,
                senderId:   userId,
                messageType: 'TEXT',
                content: `부하테스트 메시지 ${cnt + 1} VU${__VU}`,
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
          // 자신 + 같은 방 다른 유저의 메시지 수신 (브로드캐스트 확인)
          msgReceivedCount.add(1);
          try {
            const bodyStart = rawData.lastIndexOf('\n\n');
            if (bodyStart !== -1) {
              const bodyJson = rawData.substring(bodyStart + 2).replace('\0', '');
              const body = JSON.parse(bodyJson);
              if (body.id) lastMsgId = body.id;
            }
          } catch (_) { /* 파싱 실패 무시 */ }
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
        check(ok, {
          'STOMP 세션 정상 완료': (v) => v === true,
          '메시지 전송 성공':     () => sentCount > 0,
        });
      });

      socket.setTimeout(() => {
        if (!stompConnected) stompConnErrors.add(1);
        socket.close();
      }, 15000);
    });

    check(res, { 'WebSocket 101': (r) => r && r.status === 101 });
    if (!res || res.status !== 101) wsConnectErrors.add(1);
  });

  // 방 퇴장
  http.post(
    `${API_URL}/chat-rooms/${roomId}/leave?userId=${userId}`,
    null,
    { headers: JSON_HEADERS },
  );

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests/load/results/websocket-stomp-summary.json': JSON.stringify(data, null, 2),
    stdout: '\n=== 부하테스트 완료 (공유 방 시나리오) ===\n결과: tests/load/results/websocket-stomp-summary.json\n',
  };
}
