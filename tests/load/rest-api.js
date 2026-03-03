/**
 * REST API 부하테스트 (k6)
 *
 * 테스트 시나리오:
 *   1. 사용자 생성 (POST /api/users)
 *   2. 채팅방 목록 조회 (GET /api/chat-rooms?userId=)
 *   3. 채팅방 생성 (POST /api/chat-rooms)
 *   4. 채팅방 입장 (POST /api/chat-rooms/{id}/join?userId=)
 *   5. 메시지 이력 조회 (GET /api/messages/chatroom/{id})
 *   6. 채팅방 퇴장 (POST /api/chat-rooms/{id}/leave?userId=)
 *
 * 실행:
 *   k6 run tests/load/rest-api.js
 *   k6 run --env BASE_URL=http://your-server:8080 tests/load/rest-api.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { API_URL, THRESHOLDS, RAMP_UP_STAGES } from './config.js';

// 커스텀 메트릭
const userCreateErrors = new Counter('user_create_errors');
const roomCreateErrors = new Counter('room_create_errors');
const joinRoomErrors   = new Counter('join_room_errors');
const msgHistoryErrors = new Counter('msg_history_errors');
const apiSuccessRate   = new Rate('api_success_rate');
const roomJoinDuration = new Trend('room_join_duration', true);

// k6 옵션
export const options = {
  stages: RAMP_UP_STAGES,
  thresholds: {
    ...THRESHOLDS,
    user_create_errors:  ['count<10'],
    room_create_errors:  ['count<10'],
    join_room_errors:    ['count<20'],
    api_success_rate:    ['rate>0.99'],
    room_join_duration:  ['p(95)<800'],
  },
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export default function () {
  const vu   = __VU;
  const iter = __ITER;

  // ─────────────────────────────────────────
  // STEP 1: 사용자 생성
  // ─────────────────────────────────────────
  let userId;
  group('사용자 생성', () => {
    const res = http.post(
      `${API_URL}/users`,
      { nickname: `load_user_${vu}_${iter}` },
    );

    const ok = check(res, {
      '사용자 생성 2xx': (r) => r.status >= 200 && r.status < 300,
      '사용자 ID 존재': (r) => {
        try { return r.json().id != null; } catch (_) { return false; }
      },
    });

    apiSuccessRate.add(ok);
    if (!ok) { userCreateErrors.add(1); return; }
    userId = res.json().id;
  });

  if (!userId) { sleep(1); return; }

  // ─────────────────────────────────────────
  // STEP 2: 채팅방 목록 조회
  // ─────────────────────────────────────────
  group('채팅방 목록 조회', () => {
    const res = http.get(`${API_URL}/chat-rooms?userId=${userId}`);

    const ok = check(res, {
      '채팅방 목록 200': (r) => r.status === 200,
      '배열 형식 반환':  (r) => {
        try { return Array.isArray(r.json()); } catch (_) { return false; }
      },
    });
    apiSuccessRate.add(ok);
  });

  // ─────────────────────────────────────────
  // STEP 3: 채팅방 생성
  // ─────────────────────────────────────────
  let roomId;
  group('채팅방 생성', () => {
    const res = http.post(
      `${API_URL}/chat-rooms`,
      { name: `테스트방_${vu}_${iter}`, creatorId: userId },
    );

    const ok = check(res, {
      '채팅방 생성 2xx': (r) => r.status >= 200 && r.status < 300,
      '방 ID 존재': (r) => {
        try { return r.json().id != null; } catch (_) { return false; }
      },
    });

    apiSuccessRate.add(ok);
    if (!ok) { roomCreateErrors.add(1); return; }
    roomId = res.json().id;
  });

  if (!roomId) { sleep(1); return; }

  // ─────────────────────────────────────────
  // STEP 4: 채팅방 입장 (Query Param)
  // ─────────────────────────────────────────
  group('채팅방 입장', () => {
    const start = Date.now();
    const res = http.post(
      `${API_URL}/chat-rooms/${roomId}/join?userId=${userId}`,
      null,
      { headers: JSON_HEADERS },
    );
    roomJoinDuration.add(Date.now() - start);

    const ok = check(res, {
      '채팅방 입장 200': (r) => r.status === 200,
      '방 ID 반환':      (r) => {
        try { return r.json().id != null; } catch (_) { return false; }
      },
    });

    apiSuccessRate.add(ok);
    if (!ok) joinRoomErrors.add(1);
  });

  // ─────────────────────────────────────────
  // STEP 5: 메시지 이력 조회
  // ─────────────────────────────────────────
  group('메시지 이력 조회', () => {
    const res = http.get(`${API_URL}/messages/chatroom/${roomId}`);

    const ok = check(res, {
      '메시지 이력 200': (r) => r.status === 200,
      '배열 형식 반환':  (r) => {
        try { return Array.isArray(r.json()); } catch (_) { return false; }
      },
    });

    apiSuccessRate.add(ok);
    if (!ok) msgHistoryErrors.add(1);
  });

  // ─────────────────────────────────────────
  // STEP 6: 채팅방 퇴장 (POST, Query Param)
  // ─────────────────────────────────────────
  group('채팅방 퇴장', () => {
    const res = http.post(
      `${API_URL}/chat-rooms/${roomId}/leave?userId=${userId}`,
      null,
      { headers: JSON_HEADERS },
    );

    const ok = check(res, {
      '채팅방 퇴장 204': (r) => r.status === 204,
    });
    apiSuccessRate.add(ok);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests/load/results/rest-api-summary.json': JSON.stringify(data, null, 2),
  };
}
