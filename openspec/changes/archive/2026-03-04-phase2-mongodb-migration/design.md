## Context

Phase 1에서 구축된 시스템은 MySQL + JPA 기반 단일 Spring Boot 애플리케이션이다. 메시지 저장, 읽음 상태 추적, 방 관리 모두 RDB 스키마에 의존하고 있으며, 채팅방 내 유저가 수백 명을 초과하면 다음 문제들이 나타난다.

- **읽음 상태 집계 쿼리 병목:** `SELECT COUNT(*) FROM read_status WHERE message_id IN (...)` 형태의 N+1 쿼리가 메시지 수에 비례하여 급증
- **스키마 경직성:** 메시지 메타데이터 추가 시 ALTER TABLE 필요
- **단일 서버 상태 의존:** HTTP 세션이 서버 메모리에 종속되어 수평 확장 불가
- **단일 모듈 결합도:** 실시간 채팅 처리 로직과 REST API 로직이 동일 모듈에 혼재

Phase 2의 목표는 1,000명 이상의 동시 접속을 수용하고 전체 Throughput을 개선하기 위해 저장소 전환, 아키텍처 분리, 상태 제거를 단계적으로 수행하는 것이다.

## Goals / Non-Goals

**Goals:**
- MySQL 메시지/읽음 상태 저장소를 MongoDB로 전환하고 비정규화 문서 모델 확립
- JPA N+1 문제를 Fetch Join 및 DTO Projection으로 해소
- 읽음 상태 원자성을 Redis `HINCRBY`/`SETNX` 연산으로 보장
- Gradle 멀티모듈(`chat-server`, `api-server`, `common-domain`)로 관심사 분리
- JWT + Redis 기반 Stateless 인증으로 수평 확장 기반 마련
- Cursor-based 페이징으로 대용량 메시지 이력 조회 성능 확보

**Non-Goals:**
- Kafka, RabbitMQ 등 외부 메시지 브로커 도입 (SimpleBroker 유지)
- Kubernetes / 컨테이너 오케스트레이션 설정
- 클라이언트(React) 대규모 리팩토링 — API 계약 변경 최소화
- MySQL 완전 제거 — Room·User 등 관계형 데이터는 MySQL 유지

## Decisions

### 결정 1: 메시지 저장소 — MongoDB 비정규화 모델

**선택:** Room 문서에 최신 메시지 일부를 포함하고, Message 컬렉션은 `roomId` + `createdAt`으로 인덱싱.

```json
// messages 컬렉션
{
  "_id": ObjectId,
  "roomId": "uuid",
  "senderId": "uuid",
  "senderNickname": "string",   // 비정규화: User 조인 제거
  "content": "string",
  "type": "TEXT|IMAGE|SYSTEM",
  "readCount": 0,               // 집계 캐시 (Redis와 주기적 동기화)
  "readBy": ["userId1", ...],   // 소규모(≤100) 방용 인라인 배열
  "createdAt": ISODate
}
```

**대안 검토:**
- MySQL JSON 컬럼: 인덱스 한계, 집계 쿼리 개선 어려움 → 기각
- Cassandra: 운영 복잡도 과다, 팀 러닝 커브 높음 → 기각

**트레이드오프:** `readBy` 인라인 배열은 1,000명 이상 방에서 문서 크기 초과 위험. 1,000명 초과 방은 별도 `read_status` 컬렉션으로 분리하는 **Hybrid 전략** 적용.

---

### 결정 2: 읽음 상태 원자성 — Redis HINCRBY + Lua Script

**선택:** 메시지별 읽음 카운트를 Redis Hash(`read:{messageId}`)에 저장. 원자성이 필요한 "최초 읽음 등록"은 Lua 스크립트로 SETNX + HINCRBY를 단일 트랜잭션 처리.

```lua
-- 원자적 읽음 등록 (중복 방지)
local key = "read:" .. KEYS[1]
local userId = ARGV[1]
if redis.call("SADD", key .. ":users", userId) == 1 then
  return redis.call("HINCRBY", "readcount", KEYS[1], 1)
end
return 0
```

MongoDB에는 배치로 주기적 반영 (5초 간격 스케줄러).

**대안 검토:**
- MongoDB `$inc` + `$addToSet` 단독: 네트워크 왕복 2회 필요, 고부하 시 경쟁 조건 발생 가능 → 보조로만 사용
- DB 트랜잭션(Optimistic Lock): 충돌 재시도 오버헤드 → 기각

---

### 결정 3: 쿼리 최적화 — Fetch Join + DTO Projection 전략

**선택:** 연관 엔티티 조회 시 다음 우선순위 적용.
1. **단순 목록 조회** → `@Query("SELECT new dto.RoomSummaryDto(...) FROM Room r JOIN FETCH r.participants")`로 DTO 직접 조회
2. **단일 엔티티 상세** → `JOIN FETCH`로 필요한 연관만 즉시 로딩
3. **집계/통계** → `@Query` Native SQL 또는 MongoDB Aggregation Pipeline

`@EntityGraph` 남용 금지 — MultipleBagFetchException 위험.

---

### 결정 4: 멀티모듈 구조

```
netmarble-chat/
├── common-domain/       # 도메인 모델, 인터페이스, DTO (인프라 의존 없음)
│   └── src/main/java/com/netmarble/chat/domain/
├── api-server/          # REST API, WebSocket STOMP 엔드포인트
│   └── depends on: common-domain
└── chat-server/         # 실시간 메시지 처리, 읽음 상태 집계
    └── depends on: common-domain
```

**의존성 방향 규칙 (단방향):**
- `api-server` → `common-domain` (O)
- `chat-server` → `common-domain` (O)
- `api-server` ↔ `chat-server` (X — 직접 의존 금지)
- `common-domain` → 인프라 모듈 (X)

**대안 검토:**
- 단일 모듈 유지: 확장성 한계 명확, 기각
- 4개 이상 분리: 현재 팀 규모에 과도한 복잡도 → 3개로 제한

---

### 결정 5: Cursor-based 페이징

**선택:** 메시지 이력 조회 API를 Offset 기반에서 Cursor 기반으로 전환.

```
GET /api/rooms/{roomId}/messages?cursor={lastMessageId}&limit=50&direction=BEFORE
```

MongoDB 쿼리: `{ roomId, _id: { $lt: ObjectId(cursor) } } .sort({ _id: -1 }).limit(50)`

**이유:** Offset 페이징은 skip(N) 연산이 O(N) 스캔을 수행. 메시지 수십만 건 이상에서 성능 급락. ObjectId 자체가 시간 순서를 포함하므로 별도 정렬 인덱스 불필요.

---

### 결정 6: Stateless 인증 — JWT + Redis 블랙리스트

**선택:** Spring Security + jjwt 라이브러리로 AccessToken(15분) + RefreshToken(7일) 발급. 로그아웃 시 Redis 블랙리스트에 AccessToken JTI 등록.

**서버 Stateless 보장 조건:**
- HttpSession 비활성화 (`SessionCreationPolicy.STATELESS`)
- STOMP 핸드셰이크 시 JWT 검증 (HandshakeInterceptor)
- 로드밸런서 세션 어피니티(sticky session) 불필요

## Risks / Trade-offs

| 리스크 | 완화 전략 |
|--------|-----------|
| MongoDB 전환 중 데이터 유실 | 이중 쓰기(Dual Write) 기간 운영 후 MySQL 읽기 중단 → MongoDB 단독 전환 |
| Redis 장애 시 읽음 상태 손실 | Redis AOF 영속성 설정 + 장애 시 MongoDB fallback 쿼리 |
| 멀티모듈 전환 중 빌드 깨짐 | feature 브랜치에서 단계적 분리, CI에서 전체 모듈 빌드 검증 |
| JWT 탈취 시 AccessToken 무효화 불가 | 짧은 만료(15분) + Redis 블랙리스트로 즉시 폐기 지원 |
| `readBy` 배열 문서 크기 초과 (16MB 한계) | 500명 초과 시 별도 컬렉션 자동 전환 로직 |

## Migration Plan

**단계 1 — common-domain 모듈 추출 (1주)**
1. 기존 `server/` 에서 도메인 클래스, 인터페이스, DTO를 `common-domain/`으로 이동
2. `api-server`가 `common-domain`을 의존하도록 `build.gradle` 재구성
3. 기존 `server/` 제거 또는 `chat-server/`로 rename

**단계 2 — MongoDB 저장소 추가 (1주)**
1. `spring-boot-starter-data-mongodb` 추가
2. `MessageMongoRepository` 구현 (기존 JPA 레포지토리와 병행)
3. 새 메시지는 MongoDB에만 저장 (Dual Write 없이 cut-over)
4. 메시지 조회 API를 MongoDB 레포지토리로 교체

**단계 3 — Redis 읽음 상태 이관 (1주)**
1. Redis SADD/HINCRBY 기반 읽음 처리 구현
2. 배치 스케줄러로 MongoDB `readCount` 동기화
3. 기존 MySQL `read_status` 테이블 Write 중단

**단계 4 — JWT 인증 전환 (1주)**
1. jjwt 라이브러리 추가, JWT 발급/검증 서비스 구현
2. STOMP HandshakeInterceptor JWT 검증 추가
3. 기존 세션 기반 인증 제거

**롤백 전략:** 각 단계는 독립적으로 Feature Flag(`@ConditionalOnProperty`)로 제어. 문제 발생 시 프로퍼티 변경만으로 이전 구현으로 즉시 복귀 가능.

## Open Questions

1. **읽음 상태 히스토리 보존 요구 사항:** 읽음 시각(timestamp)까지 저장해야 하는가, 아니면 카운트만으로 충분한가? → 비즈니스 요구 확인 필요
2. **Kafka 도입 시점:** Phase 3에서 이벤트 소싱 도입 예정 시, chat-server와 api-server 간 통신을 REST vs Kafka 중 어떤 방식으로 할 것인가?
3. **MongoDB Atlas vs 자체 호스팅:** 운영 환경 MongoDB 배포 방식 결정 필요
4. **공유 도메인 엔티티의 JPA 어노테이션 처리:** `common-domain`에 JPA `@Entity`를 포함시킬 경우 Jakarta Persistence 의존성이 발생함. 순수 POJO + 별도 JPA 엔티티 매핑 방식으로 분리할지 결정 필요
