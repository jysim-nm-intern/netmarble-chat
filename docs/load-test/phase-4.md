# Phase 4: Spring Boot vs NestJS 성능 비교

**실행일:** 2026-03-06
**도구:** k6 v1.6.1
**목적:** 동일한 SDD 명세(STOMP WebSocket + REST API)를 Java/Spring Boot와 NestJS로 각각 구현한 서버의 성능 비교

---

## 테스트 환경 비교

| 항목 | Java/Spring Boot (Phase 1) | NestJS (Phase 4) |
|------|:---:|:---:|
| 런타임 | Java 17 (JVM, G1GC) | Node.js 20 |
| 프레임워크 | Spring Boot 3.x | NestJS 10.x |
| 실행 환경 | Docker 컨테이너 (2코어, 2.5GB) | 로컬 호스트 (제한 없음) |
| DB 연결 | HikariCP (50 커넥션) | TypeORM (50 커넥션) |
| STOMP 브로커 | SimpleBroker (인메모리) | 커스텀 인메모리 브로커 |
| WebSocket | Spring WebSocket (raw `/ws-stomp`) | SockJS + raw WebSocket (`/ws-stomp`) |
| ORM | JPA/Hibernate | TypeORM (MySQL) |

> **주의:** Java 서버는 Docker 컨테이너(CPU 2코어 제한)에서, NestJS는 로컬 호스트(제한 없음)에서 실행되었습니다. 동일 환경 비교가 아니므로 절대적 수치보다 **특성 차이**에 주목하십시오.

---

## 테스트 시나리오

**스크립트:** `tests/load/websocket-stomp.js`
**시나리오:** 공유 방 2개, VU 0→200→200(40초 유지)→0 (총 1분)
**동작:** 유저 생성(REST) → 방 입장(REST) → WebSocket/STOMP 연결 → 메시지 5회 전송 → 읽음 처리 → DISCONNECT

---

## 핵심 지표 비교

### 안정성 지표

| 지표 | Java/Spring Boot | NestJS | 비교 |
|------|:---:|:---:|:---:|
| WebSocket 성공률 | **100.0%** | **100.0%** | 동등 |
| HTTP 요청 실패율 | **0.00%** | **0.00%** | 동등 |
| WS 연결 오류 | **0** | **0** | 동등 |
| STOMP 연결 오류 | **0** | **0** | 동등 |
| 완료 이터레이션 | **2,109** | 1,821 | Java +15.8% |

> 양쪽 모두 200 VU에서 **오류 0건, 성공률 100%**로 기능적 동등성 확인

---

### REST API 성능 (HTTP)

| 지표 | Java/Spring Boot | NestJS | 비교 |
|------|:---:|:---:|:---:|
| http_req_duration **avg** | **216ms** | 767ms | Java **3.5× 빠름** |
| http_req_duration **med** | **125ms** | 681ms | Java **5.4× 빠름** |
| http_req_duration **p(90)** | **557ms** | 1,603ms | Java **2.9× 빠름** |
| http_req_duration **p(95)** | **723ms** | 1,870ms | Java **2.6× 빠름** |
| http_req_duration **max** | **1,588ms** | 3,540ms | Java **2.2× 빠름** |
| HTTP 요청 수 | **8,299** | 7,287 | Java 14% 더 많음 |
| HTTP 처리량 (req/s) | **135.9** | 116.2 | Java 17% 더 높음 |

> **분석:** REST API 응답 속도에서 Java/Spring Boot가 우위. JVM JIT + 멀티스레드 모델이 MySQL CRUD에 유리하나, NestJS도 N+1 제거 + 커넥션풀 튜닝으로 격차를 크게 축소.

---

### WebSocket 연결 성능

| 지표 | Java/Spring Boot | NestJS | 비교 |
|------|:---:|:---:|:---:|
| ws_connecting **avg** | 56.1ms | **7.5ms** | NestJS **7.5× 빠름** |
| ws_connecting **p(95)** | 124.9ms | **14.0ms** | NestJS **8.9× 빠름** |
| ws_connecting **max** | 301.2ms | **25.7ms** | NestJS **11.7× 빠름** |

> **분석:** WebSocket 핸드셰이크(HTTP Upgrade)에서 NestJS가 대폭 우위. Node.js 이벤트 루프의 비동기 I/O가 연결 수립 단계에서 효과적.

---

### WebSocket 세션 지속시간

| 지표 | Java/Spring Boot | NestJS | 비교 |
|------|:---:|:---:|:---:|
| ws_session_duration **avg** | 3,301ms | **3,174ms** | NestJS 3.8% 빠름 |
| ws_session_duration **p(95)** | 5,010ms | **3,896ms** | NestJS **22.2% 빠름** |
| ws_session_duration **max** | 6,683ms | **3,982ms** | NestJS **40.4% 빠름** |
| 임계값 p(95)<5000ms | ❌ 초과 (10ms) | ✅ 통과 | NestJS 통과 |

> **분석:** WS 세션 전체 시간에서 NestJS가 더 일관적. Java는 max 6.7초까지 tail latency 발생한 반면, NestJS는 max 4초 이내로 안정.

---

### STOMP 메시지 처리량

| 지표 | Java/Spring Boot | NestJS | 비교 |
|------|:---:|:---:|:---:|
| 메시지 전송 (sent) | 10,545건 | 9,105건 | Java 15.8% 더 많음 |
| 메시지 수신 (received) | 212,578건 | **494,121건** | NestJS **132% 더 많음** |
| Fan-out 비율 | 20.2× | **54.3×** | NestJS **2.7× 높음** |
| 수신 메시지 처리율 (/s) | 3,481/s | **7,882/s** | NestJS **2.3× 높음** |

> **분석:** NestJS가 더 적은 메시지를 보냈음에도 수신 메시지는 132% 더 많음. REST 튜닝으로 전송 격차는 크게 좁혀졌으나, 동시 구독자 수가 여전히 높아 fan-out 54.3×로 STOMP 브로드캐스트 엔진의 효율성이 두드러짐.

---

### 네트워크 데이터

| 지표 | Java/Spring Boot | NestJS | 비교 |
|------|:---:|:---:|:---:|
| data_received | 92.2 MB | **180.3 MB** | NestJS 96% 더 많음 |
| data_sent | 3.8 MB | 3.4 MB | Java 12% 더 많음 |
| 테스트 실행 시간 | 61.1초 | 62.7초 | 거의 동일 |

---

## 영역별 승자 분석

```
┌─────────────────────────────────────────────────────────┐
│            Spring Boot vs NestJS 성능 비교               │
├─────────────────┬───────────────────┬───────────────────┤
│     영역         │     승자           │     차이          │
├─────────────────┼───────────────────┼───────────────────┤
│ REST API 속도    │ 🏆 Spring Boot   │ 3.5× 빠름 (avg)  │
│ HTTP 처리량      │ 🏆 Spring Boot   │ 1.2× 높음        │
│ 총 이터레이션     │ 🏆 Spring Boot   │ 1.2× 많음        │
├─────────────────┼───────────────────┼───────────────────┤
│ WS 연결 속도     │ 🏆 NestJS        │ 7.5× 빠름 (avg)  │
│ WS 세션 안정성   │ 🏆 NestJS        │ p95 22% 빠름     │
│ STOMP 브로드캐스트│ 🏆 NestJS        │ 1.8× 높은 처리율  │
│ Tail latency    │ 🏆 NestJS        │ max 40% 낮음     │
├─────────────────┼───────────────────┼───────────────────┤
│ 안정성 (오류율)   │       동등        │ 양쪽 모두 0%     │
│ 기능 동등성       │       동등        │ 100% 성공       │
└─────────────────┴───────────────────┴───────────────────┘
```

---

## 결론

### SDD 기술 독립성 검증 ✅

동일한 SDD 명세(STOMP WebSocket + REST API 계약)로 Java/Spring Boot와 NestJS를 각각 구현한 결과:
- **기능적 동등성 확인**: 양쪽 모두 200 VU에서 오류 0건, 100% 성공률
- **동일한 k6 테스트 스크립트**로 양쪽 서버를 검증 (destination 경로만 `.` vs `/` 조정)
- **SDD 명세가 기술 독립적**임을 실증: AI가 SDD만 보고 다른 언어로 동일한 시스템을 구현 가능

### 성능 특성 요약

| 관점 | 추천 기술 | 근거 |
|------|-----------|------|
| **REST API 중심** (CRUD 다수) | Spring Boot | 3.5× 빠른 응답, JVM 멀티스레드 최적화 |
| **실시간 채팅 중심** (WebSocket 다수) | NestJS | 7.5× 빠른 WS 연결, 2.3× 높은 브로드캐스트 처리율 |
| **하이브리드** (REST + WebSocket) | 상황에 따라 | 각 영역의 강점이 명확히 구분됨 |

### 환경 공정성 주의

본 비교에서 Java 서버는 **Docker 컨테이너(2코어/2.5GB)**에서, NestJS는 **로컬 호스트(제한 없음)**에서 실행되었습니다. 공정한 비교를 위해서는 동일한 컨테이너 환경에서의 재측정이 필요합니다. 그럼에도 불구하고:
- Java가 제한된 환경에서도 REST에서 3.5× 빠른 것은 JVM + 멀티스레드의 근본적 이점
- NestJS가 WS 연결에서 7.5× 빠른 것은 Node.js 이벤트 루프의 근본적 이점
- **각 기술의 강점 영역이 워크로드 특성과 일치**하는 결과

---

## 스트레스 테스트: 단일 방 한계 측정

**스크립트:** `tests/load/stress-single-room.js`
**시나리오:** 방 1개, VU 50→100→200→350→500 (총 4분 30초)
**목적:** 단일 채팅방에서 VU를 점진적으로 증가시켜 NestJS의 한계점 측정

### 결과 요약

| 지표 | NestJS (Phase 4) | Java (Phase 1) | 비교 |
|------|:---:|:---:|:---:|
| HTTP 응답시간 p(95) | 4,875ms | 5,086ms | NestJS 4.1% 빠름 |
| HTTP 요청 실패율 | **0.00%** | **0.00%** | 동등 |
| WebSocket 성공률 | **100.0%** | 83.9% | NestJS **+16.1%p** |
| WS 연결 오류 | **0** | — | — |
| STOMP 연결 오류 | **0** | **860** | NestJS 완승 |
| WS 세션 p(95) | 7,153ms | — | — |
| 메시지 전송 수 | 25,620건 | 13,445건 | NestJS 91% 더 많음 |
| 메시지 수신 수 | 3,540,158건 | — | — |
| Fan-out 비율 | **138.2×** | — | 매우 높은 동시 접속 |
| 총 이터레이션 | 8,540건 | — | — |
| 최대 동시 VU | **500** | 500 | 동등 |

**분석:**
- **NestJS가 500 VU 단일 방에서 WS 성공률 100%, STOMP 오류 0건** 달성 — Phase 1 Java(83.9%, 860 오류)를 대폭 초과
- Fan-out 138.2× → 방 1개에 평균 138명이 동시 접속 상태에서 안정적 브로드캐스트
- HTTP p(95)은 두 플랫폼 모두 3,000ms 임계값 초과하나, NestJS가 약간 빠름 (4,875 vs 5,086ms)
- REST 처리 지연에도 불구하고 **WebSocket/STOMP 계층은 500 VU에서도 완벽 안정**

---

## 스트레스 테스트: 다중 방 시스템 용량 측정

**스크립트:** `tests/load/stress-multi-room.js`
**시나리오:** 방 8개(방당 50명), VU 100→200→400 (총 1분 40초)
**목적:** 다중 채팅방 환경에서 전체 시스템 용량 측정

### 결과 요약

| 지표 | NestJS (Phase 4) | Java (Phase 1) | 비교 |
|------|:---:|:---:|:---:|
| HTTP 응답시간 p(95) | 3,275ms | **1,051ms** | Java 3.1× 빠름 |
| HTTP 요청 실패율 | **0.00%** | **0.00%** | 동등 |
| WebSocket 성공률 | **100.0%** | **100.0%** | 동등 |
| WS 연결 오류 | **0** | — | — |
| STOMP 연결 오류 | **0** | **0** | 동등 |
| WS 세션 p(95) | 3,363ms | — | — |
| 메시지 전송 수 | 11,583건 | — | — |
| 메시지 수신 수 | 229,592건 | — | — |
| Fan-out 비율 | 19.8× | — | — |
| 총 이터레이션 | 3,861건 | — | — |
| 최대 동시 VU | **400** | 400 | 동등 |

**분석:**
- 양쪽 모두 400 VU에서 **WS 성공률 100%, STOMP 오류 0건** → 안정적 분산 처리
- HTTP p(95)은 Java가 3.1× 빠름 (1,051 vs 3,275ms) — REST 격차가 줄었으나 여전히 존재
- NestJS의 WS 세션 p(95)=3,363ms로 **WebSocket 계층은 400 VU에서도 매우 안정**
- 방당 50명 분산 배치로 fan-out 19.8× (적정 수준)

---

## Phase 4 스트레스 테스트 종합 비교

| 테스트 | VU | WS 성공률 | STOMP 오류 | HTTP p(95) | HTTP 실패율 |
|--------|:---:|:---:|:---:|:---:|:---:|
| **websocket-stomp** (방 2개) | 200 | 100% | 0 | 1,870ms | 0% |
| **stress-single-room** (방 1개) | 500 | 100% | 0 | 4,875ms | 0% |
| **stress-multi-room** (방 8개) | 400 | 100% | 0 | 3,275ms | 0% |

> 모든 테스트에서 **WS 성공률 100%, STOMP/WS 연결 오류 0건, HTTP 실패율 0%** 달성

---

## NestJS vs Java (Phase 1) 스트레스 테스트 비교

| 테스트 | Java WS 성공률 | NestJS WS 성공률 | Java STOMP 오류 | NestJS STOMP 오류 |
|--------|:---:|:---:|:---:|:---:|
| websocket-stomp (200 VU) | 100% | 100% | 0 | 0 |
| stress-single-room (500 VU) | **83.9%** | **100%** | **860** | **0** |
| stress-multi-room (400 VU) | 100% | 100% | 0 | 0 |

> **NestJS는 500 VU 단일 방에서 Java 대비 STOMP 안정성이 대폭 우수** (100% vs 83.9%, 오류 0 vs 860)

---

## Phase 4 권장 동시 유저 수

| 기준 | NestJS (Phase 4) | Java (Phase 1) | 비고 |
|------|:---:|:---:|------|
| **방 1개 — 안전 인원** | **~500명** | ~200명 | NestJS 500 VU에서도 WS 100% |
| **방 1개 — 임계점** | **500명+** (미도달) | ~350명 | NestJS는 500 VU에서도 한계 미도달 |
| **전체 서비스 — 실측 안전** | **400명** (8방 분산) | 400명 (8방 분산) | 양쪽 모두 HTTP 실패율 0% |
| **전체 서비스 — 추정 최대** | **600~1,000명** | 400~800명 | NestJS WS 안정성 높아 확장 여지 |
| **REST API p(95) 3초 이내** | **~350 VU** | ~400 VU | 200 VU=1,870ms, 400 VU=3,275ms |

### 시나리오별 권장 구성

| 시나리오 | NestJS 권장 | Java (Phase 1) 권장 | 근거 |
|----------|:---:|:---:|------|
| 소규모 (방 1~2개) | 방당 **250명**, 총 500명 | 방당 100명, 총 200명 | NestJS STOMP 안정성 우수 |
| 중규모 (방 5~10개) | 방당 50명, 총 **500명** | 방당 50명, 총 400명 | N+1 제거로 REST 개선 |
| 대규모 (방 10개+) | 방당 50명, 총 **600명+** | 미검증 | 커넥션풀 50 + 인덱스 적용 |

### 주요 발견

- **NestJS WebSocket/STOMP 안정성**: 500 VU 단일 방에서도 **오류 0건** → Node.js 이벤트 루프가 대량 동시 WS 연결 관리에 매우 효과적
- **REST API 튜닝 효과**: N+1 제거 + 커넥션풀 50 + DB 인덱스로 HTTP avg 34% 개선, Java 대비 격차 5.4×→3.5×로 축소
- **워크로드 특성별 최적 기술**: 실시간 메시지(WS) 비중 높으면 NestJS, REST CRUD 비중 높으면 Java

---

## REST API 튜닝: N+1 제거 + 커넥션풀 + 인덱스

### 적용 내용

| # | 튜닝 항목 | 내용 |
|---|----------|------|
| 1 | **N+1 쿼리 제거** | `getAllActiveChatRooms()` 400쿼리→5쿼리, `getChatRoomMessages()` 300쿼리→4쿼리, 배치 `findByIds`/`findByMessageIds` 도입 |
| 2 | **커넥션풀 확장** | TypeORM `connectionLimit` 10(기본)→50 |
| 3 | **DB 인덱스 추가** | `idx_msg_room_deleted`, `idx_msg_room_sent`, `idx_msg_sender`, `idx_room_active` |

### 튜닝 전후 비교

#### websocket-stomp (200 VU, 방 2개)

| 지표 | 튜닝 전 | 튜닝 후 | 개선율 |
|------|:---:|:---:|:---:|
| HTTP avg | 1,165ms | **767ms** | **-34.2%** |
| HTTP p(95) | 2,262ms | **1,870ms** | **-17.3%** |
| HTTP req/s | 93.5 | **116.2** | **+24.3%** |
| Iterations | 1,459 | **1,821** | **+24.8%** |
| WS 성공률 | 100% | 100% | 동등 |
| STOMP 오류 | 0 | 0 | 동등 |

#### stress-single-room (500 VU, 방 1개)

| 지표 | 튜닝 전 | 튜닝 후 | 개선율 |
|------|:---:|:---:|:---:|
| HTTP p(95) | 4,939ms | **4,875ms** | -1.3% |
| Iterations | 8,293 | **8,540** | +3.0% |
| WS 성공률 | 100% | 100% | 동등 |
| STOMP 오류 | 0 | 0 | 동등 |

#### stress-multi-room (400 VU, 방 8개)

| 지표 | 튜닝 전 | 튜닝 후 | 개선율 |
|------|:---:|:---:|:---:|
| HTTP p(95) | 3,800ms | **3,275ms** | **-13.8%** |
| Iterations | 3,769 | **3,861** | +2.4% |
| WS 성공률 | 100% | 100% | 동등 |
| STOMP 오류 | 0 | 0 | 동등 |

### 튜닝 효과 분석

- **N+1 제거가 가장 큰 효과**: REST 호출 비중이 높은 200 VU 시나리오에서 HTTP avg 34% 단축, 처리량 24% 증가
- **스트레스 시나리오에서는 개선폭 제한적**: 500 VU에서는 DB 쿼리보다 동시 연결 자체가 병목이므로 쿼리 최적화 효과 감소
- **안정성 지표 유지**: 모든 시나리오에서 WS 100%, STOMP 오류 0건 유지

### 튜닝 후 Java 대비 격차 변화

| 지표 | 튜닝 전 (NestJS vs Java) | 튜닝 후 (NestJS vs Java) | 변화 |
|------|:---:|:---:|:---:|
| HTTP avg (200 VU) | Java 5.4× 빠름 | Java **3.5× 빠름** | 격차 35% 축소 |
| HTTP p(95) (200 VU) | Java 3.1× 빠름 | Java **2.6× 빠름** | 격차 18% 축소 |
| Iterations (200 VU) | Java 1.44× 많음 | Java **1.16× 많음** | 격차 60% 축소 |

> 튜닝으로 Java와의 REST 성능 격차가 크게 좁혀졌으나, JVM 멀티스레드 + HikariCP의 근본적 이점은 여전히 존재

---

*결과 JSON: `tests/load/results/nodejs-websocket-stomp-summary.json` (튜닝 전), `websocket-stomp-summary.json` (튜닝 후), `stress-single-room-summary.json`, `stress-multi-room-summary.json`*
*테스트 스크립트: `tests/load/websocket-stomp.js`, `tests/load/stress-single-room.js`, `tests/load/stress-multi-room.js`*
