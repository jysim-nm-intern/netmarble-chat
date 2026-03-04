/**
 * 8.5 — 메시지 목록 조회 P99 응답 시간 200ms 이하 확인
 *
 * 전제: MongoDB에 roomId="2"로 5000건 이상 메시지가 시딩된 상태
 * 대상: api-server(8081) cursor-based 메시지 조회 API
 *
 * 실행:
 *   # 시딩 먼저 실행 후:
 *   k6 run tests/load/phase2/message-query-perf.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { API_API } from './config.js';

const queryDuration = new Trend('msg_query_duration', true);
const cursorPageDuration = new Trend('cursor_page_duration', true);

const ROOM_ID = '2';

export const options = {
  stages: [
    { duration: '15s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'msg_query_duration': ['p(99)<200'],
    'cursor_page_duration': ['p(99)<200'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  // 1) 첫 페이지 조회 (최신 50건)
  const res = http.get(`${API_API}/rooms/${ROOM_ID}/messages?limit=50`);
  const firstOk = check(res, {
    'status 200': (r) => r.status === 200,
    'has messages': (r) => {
      try { return JSON.parse(r.body).messages.length > 0; }
      catch { return false; }
    },
  });
  queryDuration.add(res.timings.duration);

  // 2) cursor-based 다음 페이지 조회
  if (firstOk) {
    try {
      const body = JSON.parse(res.body);
      if (body.nextCursor) {
        const res2 = http.get(`${API_API}/rooms/${ROOM_ID}/messages?cursor=${body.nextCursor}&limit=50`);
        check(res2, { 'cursor page 200': (r) => r.status === 200 });
        cursorPageDuration.add(res2.timings.duration);
      }
    } catch (e) { /* ignore */ }
  }

  sleep(Math.random() * 0.5 + 0.2);
}
