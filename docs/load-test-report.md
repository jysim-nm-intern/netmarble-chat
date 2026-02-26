# 부하테스트 결과 리포트

> **작성일:** 2026-02-24
> **테스트 대상:** netmarble-chat (Spring Boot + STOMP WebSocket)
> **테스트 도구:** k6
> **테스트 환경:** 로컬 (Windows 11, MySQL 8.0 localhost:3306)

---

## 목차

1. [테스트 개요](#1-테스트-개요)
2. [기능 검증 테스트 (4회차)](#2-기능-검증-테스트-4회차)
3. [단일 채팅방 용량 테스트](#3-단일-채팅방-용량-테스트)
4. [다중 채팅방 용량 테스트](#4-다중-채팅방-용량-테스트)
5. [최적화 히스토리](#5-최적화-히스토리)
6. [결론 및 권장사항](#6-결론-및-권장사항)

---

## 1. 테스트 개요

### 시스템 스택

| 항목 | 내용 |
|------|------|
| 백엔드 | Spring Boot 3.x, Java 17 |
| 메시징 | STOMP over WebSocket (SimpleBroker) |
| DB | MySQL 8.0 (localhost:3306/netmarble_chat, `spring.profiles.active=local`) |
| 엔드포인트 | `ws://localhost:8080/ws-stomp` |
| 실행 스크립트 | `bash run-load-tests.sh` (DB 초기화 → 서버 기동 → k6 자동 실행) |

### 테스트 시나리오 흐름

```
[VU 진입]
  ↓ POST /api/users                → 사용자 생성
  ↓ POST /api/chat-rooms/{id}/join → 방 입장
  ↓ WebSocket 연결 (/ws-stomp)
  ↓ STOMP CONNECT
  ↓ SUBSCRIBE /topic/chatroom/{id} → 브로드캐스트 구독
  ↓ SEND /app/chat.sendMessage × N → 메시지 전송
  ↓ POST /api/read-status/mark-read → 읽음 처리 (REST)
  ↓ STOMP DISCONNECT
  ↓ POST /api/chat-rooms/{id}/leave → 방 퇴장
```

### 임계값 기준 (기능 검증 테스트)

| 지표 | 기준 |
|------|------|
| HTTP 실패율 | < 1% |
| HTTP 응답시간 p(95) | < 500ms |
| WebSocket 연결시간 p(95) | < 1,000ms |
| WS 연결 에러 수 | < 10건 |
| STOMP 연결 에러 수 | < 10건 |
| WS 성공률 | > 98% |
| WS 세션 지속시간 p(95) | < 5,000ms |
| STOMP 수신 메시지 수 | > 0건 |

---

## 2. 기능 검증 테스트 (4회차)

### 테스트 조건

- **VU:** 200명 (방 2개 × 100명)
- **단계:** 10초 램프업 → 40초 유지 → 10초 감소
- **메시지 전송:** VU당 5건

### 회차별 임계값 통과 현황

| 임계값 | 1차 | 2차 | 3차 | 4차 (최종) |
|--------|:---:|:---:|:---:|:----------:|
| HTTP 실패율 < 1% | ✅ | ✅ | ✅ | ✅ |
| **HTTP p(95) < 500ms** | ✅ 61ms | ❌ 7,145ms | ❌ 613ms | ✅ **287ms** |
| WS 연결시간 p(95) < 1s | ✅ | ✅ | ✅ | ✅ |
| WS 연결 에러 < 10 | ✅ | ✅ | ✅ | ✅ |
| STOMP 연결 에러 < 10 | ✅ | ✅ | ✅ | ✅ |
| WS 성공률 > 98% | ✅ | ✅ | ✅ | ✅ |
| **WS 세션 p(95) < 5s** | ✅ 1.6s | ❌ 8.5s | ✅ 3.8s | ✅ **2.8s** |
| **STOMP 수신 > 0** | ❌ **0건** | ✅ | ✅ | ✅ |
| **FAIL 항목 수** | **1개** | **2개** | **1개** | **0개 ✅** |

### 최종 테스트 (4차) 핵심 지표

| 지표 | avg | p(90) | p(95) | max |
|------|----:|------:|------:|----:|
| HTTP 응답시간 (ms) | 139 | 269 | **287** | 576 |
| WS 세션 지속시간 (ms) | 1,990 | 2,714 | **2,845** | 3,106 |
| WS 연결시간 (ms) | 1.75 | 2.33 | **2.67** | 14.4 |

| 카운터 | 값 |
|--------|---:|
| 완료 이터레이션 | 3,048 |
| STOMP 메시지 발신 | 15,240건 |
| STOMP 메시지 수신 (브로드캐스트) | **905,517건** |
| HTTP 에러 | 0건 |
| WS 연결 에러 | 0건 |
| WS 성공률 | **100%** |

---

## 3. 단일 채팅방 용량 테스트

### 테스트 조건 (`stress-single-room.js`)

- **방 수:** 1개
- **VU 증가:** 50 → 100 → 200 → 350 → 500명 (단계별 30초 유지)
- **메시지:** VU당 3건

### 단계별 성능 추이

| VU 수 | HTTP p(95) | WS 세션 p(95) | WS 성공률 | STOMP 에러 | 판정 |
|------:|----------:|:------------:|:--------:|:---------:|:----:|
| 50명 | ~50ms | ~1,600ms | 100% | 0 | ✅ 안정 |
| 100명 | ~150ms | ~2,000ms | 100% | 0 | ✅ 안정 |
| **200명** | **~300ms** | **~3,000ms** | **100%** | **0** | **✅ 권장 상한** |
| 350명 | 급증 | ~10,000ms+ | 저하 | 발생 | ⚠️ 불안정 |
| **500명** | **5,337ms** | **17,323ms** | **99.9%** | **6건** | **❌ 한계 초과** |

> **주목:** 350명 구간에서 이터레이션 카운터가 수십 초 정체하는 현상 관찰 → 서버 스레드 풀 포화 징후

### 단일 방 전체 테스트 통계

| 지표 | 값 |
|------|----|
| 총 테스트 시간 | 288초 (4분 48초) |
| 총 완료 이터레이션 | 6,224건 |
| STOMP 메시지 수신 총계 | 896,304건 |
| HTTP p(95) 전체 평균 | 5,337ms (500명 포함) |
| WS 세션 p(95) 전체 평균 | 17,323ms (500명 포함) |
| WS 성공률 전체 | 99.9% (6/6,224 실패) |

### 단일 방 결론

```
안정 구간    : ~200명 이하
경고 구간    : 200~300명 (응답 지연 시작)
한계점       : ~350명 (브로드캐스트 fan-out 포화)
절대 한계    : 500명 (세션 p(95) 17초, HTTP p(95) 5초)
```

---

## 4. 다중 채팅방 용량 테스트

### 테스트 조건 (`stress-multi-room.js`)

- **방 수:** 8개 (ROOM_COUNT=8)
- **방당 VU:** 50명 (USERS_PER_ROOM=50)
- **총 VU:** 400명
- **메시지:** VU당 3건

### 결과

| 지표 | avg | p(90) | p(95) | max |
|------|----:|------:|------:|----:|
| HTTP 응답시간 (ms) | 214 | 466 | **535** | 1,469 |
| WS 세션 지속시간 (ms) | 2,293 | 3,551 | **3,678** | 4,384 |
| WS 연결시간 (ms) | 10.3 | 20.3 | **81.3** | 216 |

| 카운터 | 값 |
|--------|---:|
| 총 VU | 400명 (8방 × 50명) |
| 완료 이터레이션 | 6,984건 |
| STOMP 메시지 발신 | 20,952건 |
| STOMP 메시지 수신 | 375,735건 |
| HTTP 에러 | 0건 |
| WS 연결 에러 | 0건 |
| STOMP 연결 에러 | 0건 |
| WS 성공률 | **100%** |

### 방 구성별 예상 성능

| 구성 | 총 VU | HTTP p(95) 예상 | 판정 |
|------|------:|----------------:|:----:|
| 2방 × 100명 | 200 | **287ms** ✅ | ✅ 완전 안정 |
| 4방 × 100명 | 400 | ~400ms | ✅ 안정 |
| 8방 × 50명 | 400 | **535ms** | ⚠️ 기준 소폭 초과 |
| 8방 × 100명 | 800 | 미측정 | 추가 테스트 필요 |

> **방당 인원이 낮을수록 브로드캐스트 부하 분산**: 8방 × 50명(400 VU)보다 2방 × 100명(200 VU)이 HTTP 응답시간이 더 낮음 → 방 수 증가보다 방당 인원 제한이 핵심

---

## 5. 최적화 히스토리

### 1차 → 2차: STOMP 경로 불일치 수정

**문제:** 테스트가 `/app/chat.message`로 발행했으나 서버 핸들러는 `/app/chat.sendMessage` 등록
**증상:** `stomp_messages_received = 0` (브로드캐스트 전혀 미수신)
**조치:** 테스트 코드 경로 3곳 수정

```
/app/chat.message         → /app/chat.sendMessage
/topic/room/{id}          → /topic/chatroom/{id}
STOMP /app/chat.read      → REST POST /api/read-status/mark-read
roomId / userId 필드명    → chatRoomId / senderId
```

---

### 2차 → 3차: 메시지 전송 시 전체 목록 재조회 제거

**문제:** `WebSocketMessageController.sendMessage()`에서 메시지 저장 후
`getChatRoomMessages()`로 전체 메시지 목록을 DB에서 재조회
**증상:** HTTP p(95) 7,145ms (200 VU 기준), 이터레이션 822건으로 격감

**조치:** `MessageApplicationService.sendMessage()` 내부에서
저장된 ChatRoom의 members를 메모리에서 직접 순회해 unreadCount 계산 후 반환

```
변경 전: INSERT → SELECT * (전체 메시지 목록) → stream().filter() → broadcast
변경 후: INSERT → calculateUnreadCount(chatRoom, message) [in-memory] → broadcast
```

**효과:** HTTP p(95) 7,145ms → 613ms (86% 개선)

---

### 3차 → 4차: 읽음 처리 ChatRoom CASCADE 저장 제거

**문제:** `ReadStatusApplicationService.markAsRead()`에서
`chatRoomRepository.findById()` → 멤버 100명 전체 로드 →
`chatRoomRepository.save(chatRoom)` → 100명 멤버 CASCADE UPDATE

**증상:** HTTP p(95) 613ms (500ms 기준 초과)

**조치:**
- `ChatRoomMemberRepository` 신규 생성
- `findActiveByChatRoomIdAndUserId()` 단건 쿼리 (LEFT JOIN FETCH lastReadMessage)
- `chatRoomMemberRepository.save(member)` 단건 UPDATE

```
변경 전: SELECT ChatRoom + 100 Members → stream 탐색 → UPDATE 100 Members CASCADE
변경 후: SELECT 1 ChatRoomMember (JOIN FETCH) → UPDATE 1 ChatRoomMember
```

**효과:** HTTP p(95) 613ms → **287ms** (53% 개선), 전 임계값 통과 ✅

---

## 6. 결론 및 권장사항

### 현재 시스템 용량 (로컬 MySQL 기준)

```
┌──────────────────────────────────────────────────────────┐
│                    단일 채팅방 기준                        │
│   안정권 (전 임계값 PASS) : ~200명 동시 접속              │
│   경고권 (응답 지연 시작) : 200 ~ 300명                   │
│   한계점 (브로드캐스트 포화) : ~350명                     │
│   절대 한계             : 500명 (세션 p95=17s)            │
├──────────────────────────────────────────────────────────┤
│                   전체 시스템 기준                         │
│   완전 안정 : 방당 100명 이하 × N방 (총 200명 기준)       │
│   준안정   : 방당 50명 × 8방 = 총 400명 (HTTP 535ms)     │
│   추가 테스트 필요 : 방당 100명 × 4방 이상               │
└──────────────────────────────────────────────────────────┘
```

### 권장 운영 정책

| 항목 | 권장값 | 근거 |
|------|--------|------|
| 채팅방 최대 인원 | **100명** | 200명에서 전 지표 안정, 여유 확보 |
| 동시 접속 총 VU 상한 | **400명** | 8방 × 50명 기준 준안정 확인 |
| 브로드캐스트 경고 임계 | **방당 200명** | 이 이상부터 fan-out 비용 급증 |

### 프로덕션 전환 시 개선 필요 사항

| 항목 | 현황 | 개선 방향 |
|------|------|-----------|
| DB | MySQL 8.0 (로컬) | 운영 DB 서버(RDS 등) 전환 후 재측정 필요 |
| 메시지 브로커 | SimpleBroker (단일 노드) | RabbitMQ/Kafka 도입 시 수평 확장 가능 |
| 읽음 처리 성능 | REST 호출 per VU | 배치 처리 또는 STOMP 핸들러 추가 고려 |
| 연결 유지 | 세션 per 요청 | 장기 연결 시나리오 별도 테스트 필요 |

---

*테스트 스크립트: `tests/load/websocket-stomp.js`, `tests/load/stress-single-room.js`, `tests/load/stress-multi-room.js`*
*결과 JSON: `tests/load/results/`*
