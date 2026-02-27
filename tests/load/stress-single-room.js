/**
 * 단일 채팅방 최대 동시 접속 스트레스 테스트
 *
 * 목적: 채팅방 1개에서 VU를 점진적으로 증가시켜 한계점 측정
 * 단계: 50 → 100 → 200 → 350 → 500 VU
 * 임계값: 에러율·응답시간이 언제 기준을 초과하는지 관찰
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

const MSG_SEND_COUNT = 3;  // 빠른 순환을 위해 3건으로 축소
const JSON_HEADERS   = { 'Content-Type': 'application/json' };

export const options = {
  // 단일 방에 VU를 단계적으로 증가
  stages: [
    { duration: '20s', target: 50  },
    { duration: '30s', target: 50  },
    { duration: '20s', target: 100 },
    { duration: '30s', target: 100 },
    { duration: '20s', target: 200 },
    { duration: '30s', target: 200 },
    { duration: '20s', target: 350 },
    { duration: '30s', target: 350 },
    { duration: '20s', target: 500 },
    { duration: '30s', target: 500 },
    { duration: '20s', target: 0   },
  ],
  // 임계값 완화: 한계를 관찰하는 것이 목적이므로 실패해도 테스트 계속 진행
  thresholds: {
    ws_connect_errors:       ['count<50'],
    stomp_connect_errors:    ['count<50'],
    ws_success_rate:         ['rate>0.80'],   // 완화: 80% 이상
    ws_session_duration_ms:  ['p(95)<15000'], // 완화: 15초 이내
    stomp_messages_received: ['count>0'],
    http_req_failed:         ['rate<0.05'],   // 완화: 5% 미만
    http_req_duration:       ['p(95)<3000'],  // 완화: 3초 이내
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
    { nickname: 'stress_coord' },
  );
  const coordId = coordRes.json().id;

  const roomRes = http.post(
    `${API_URL}/chat-rooms`,
    { name: 'stress_single_room', creatorId: coordId },
  );
  const roomId = roomRes.json().id;
  if (!roomId) throw new Error('채팅방 생성 실패');
  console.log(`[setup] 단일 스트레스 방 생성: roomId=${roomId}`);
  return { roomId };
}

export default function ({ roomId }) {
  // 사용자 생성 및 입장
  const userRes = http.post(
    `${API_URL}/users`,
    { nickname: `stress_u_${__VU}_${__ITER}` },
  );
  if (userRes.status < 200 || userRes.status >= 300) {
    wsConnectErrors.add(1);
    sleep(1);
    return;
  }
  const userId = userRes.json().id;
  if (!userId) { wsConnectErrors.add(1); sleep(1); return; }

  const joinRes = http.post(
    `${API_URL}/chat-rooms/${roomId}/join?userId=${userId}`,
    null,
    { headers: JSON_HEADERS },
  );
  check(joinRes, { '방 입장 성공': (r) => r.status === 200 });
  if (joinRes.status !== 200) { wsConnectErrors.add(1); sleep(1); return; }

  // WebSocket STOMP 세션
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
              content: `부하 ${cnt + 1} VU${__VU}` }),
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
  return {
    'tests/load/results/stress-single-room-summary.json': JSON.stringify(data, null, 2),
    stdout: '\n=== 단일 방 스트레스 테스트 완료 ===\n결과: tests/load/results/stress-single-room-summary.json\n',
  };
}
