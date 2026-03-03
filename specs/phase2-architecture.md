# Phase 2 아키텍처 기술 명세서

> **관련 GitHub Issues:** #36(성능), #37(쿼리 최적화), #38(MongoDB 전환), #39(멀티모듈), #40(수평 확장), #41(읽음 상태)
> **목표:** 단일 채팅방 1,000명 이상 수용 및 전체 시스템 Throughput 개선

---

## 1. Gradle 멀티모듈 구조 (#39)

```
netmarble-chat/
├── settings.gradle                  ← 루트 (include 3 subprojects)
├── common-domain/                   ← 순수 POJO 도메인 (인프라 의존 없음)
│   └── src/main/java/com/netmarble/chat/
│       ├── domain/model/            ChatRoom, Message, User, ChatRoomMember, Attachment
│       ├── domain/repository/       인터페이스 (JPA/Mongo 독립)
│       └── application/dto/         공유 DTO
├── api-server/                      ← Spring Boot REST API + WebSocket STOMP
│   └── src/main/java/com/netmarble/chat/
│       ├── infrastructure/jpa/      JPA 영속성 매핑
│       ├── infrastructure/mongo/    MongoDB 문서 + 레포지토리
│       ├── infrastructure/redis/    Redis 읽음 상태 + 캐시
│       ├── infrastructure/security/ JWT 인증 필터 + SecurityConfig
│       ├── application/service/     애플리케이션 서비스
│       └── presentation/controller/ REST 컨트롤러
└── chat-server/                     ← 실시간 채팅 처리 (미래 분리 대상)
```

### 의존성 방향 규칙

```
api-server   ──→  common-domain  (O)
chat-server  ──→  common-domain  (O)
api-server  ←──→  chat-server    (X 직접 의존 금지)
common-domain ──→ 인프라 패키지  (X)
```

---

## 2. MongoDB 비정규화 데이터 모델 (#38)

### messages 컬렉션

```json
{
  "_id": ObjectId,
  "roomId": "String",
  "senderId": "String",
  "senderNickname": "String",   // 비정규화: User JOIN 제거
  "content": "String",
  "type": "TEXT|IMAGE|STICKER|SYSTEM",
  "readCount": 0,               // Redis와 5초 간격 동기화
  "createdAt": ISODate
}
```

### read_status 컬렉션 (500명 초과 방 전용)

```json
{
  "_id": ObjectId,
  "messageId": "String",
  "userId": "String",
  "readAt": ISODate
}
```

### 필수 인덱스

| 컬렉션 | 인덱스 | 용도 |
|--------|--------|------|
| `messages` | `{ roomId: 1, _id: -1 }` | Cursor-based 페이징 (핵심) |
| `messages` | `{ senderId: 1, createdAt: -1 }` | 발신자별 이력 조회 |
| `read_status` | `{ messageId: 1, userId: 1 }` UNIQUE | 중복 읽음 방지 |

---

## 3. Cursor-based 메시지 페이징 API (#38)

```
GET /api/chat-rooms/{roomId}/messages?cursor={lastMessageId}&limit=50&direction=BEFORE

응답:
{
  "messages": [...],
  "nextCursor": "ObjectId",
  "hasMore": true,
  "count": 50
}
```

**MongoDB 쿼리:**
```javascript
db.messages.find({ roomId, _id: { $lt: ObjectId(cursor) } })
           .sort({ _id: -1 })
           .limit(50)
```

**장점:** ObjectId가 시간 순서를 내포하므로 별도 시간 인덱스 불필요. skip(N) 없이 O(1) 접근.

---

## 4. JPA N+1 최적화 (#37)

### Fetch Join 전략

| 조회 유형 | 전략 | 예시 |
|-----------|------|------|
| 방 목록 | `LEFT JOIN FETCH members + user` | `findAllActive()` |
| 방 상세 | `LEFT JOIN FETCH members + user + lastReadMessage` | `findById(id)` |
| 집계/통계 | Native Query / MongoDB Aggregation | - |

### N+1 자동 감지

- Hibernate Statistics 활성화 (`generate_statistics=true`)
- `QueryMonitoringInterceptor`: 요청당 JPA 쿼리 5회 초과 시 WARN 로그

### 금지 패턴

```java
// X — FetchType.EAGER 기본 설정
@ManyToOne(fetch = FetchType.EAGER)

// X — 루프 내 Repository 호출
for (Room room : rooms) { room.getParticipants(); }

// X — @EntityGraph + JOIN FETCH 혼용
```

---

## 5. Redis 읽음 상태 원자성 (#37, #41)

### 키 설계

| 키 패턴 | 타입 | TTL | 용도 |
|---------|------|-----|------|
| `read:{messageId}:users` | Set | 7일 | 중복 읽음 방지 |
| `read:{messageId}:count` | String | 7일 | 읽음 카운트 |
| `refresh:{userId}` | String | 7일 | RefreshToken 저장 |
| `blacklist:{jti}` | String | AccessToken 만료까지 | 로그아웃 토큰 |

### Lua Script (원자적 처리)

```lua
local added = redis.call('SADD', KEYS[1], ARGV[1])
if added == 1 then
  return redis.call('INCR', KEYS[2])
end
return tonumber(redis.call('GET', KEYS[2]))
```

### 장애 대응

- Redis 오류 → MongoDB `$inc` fallback 자동 전환
- 5초 간격 `@Scheduled` 배치로 Redis → MongoDB 동기화

---

## 6. JWT Stateless 인증 (#40)

### 토큰 규격

| 종류 | 유효기간 | 저장 위치 | 용도 |
|------|----------|-----------|------|
| AccessToken | 15분 | 클라이언트 메모리 | API 인증 |
| RefreshToken | 7일 | Redis (`refresh:{userId}`) | AccessToken 갱신 |

### 인증 흐름

```
클라이언트 → POST /api/auth/login → AccessToken + RefreshToken
클라이언트 → API 요청 (Authorization: Bearer {accessToken})
  → JwtAuthenticationFilter → 서명 검증 → Redis 블랙리스트 확인
  → SecurityContext 설정
클라이언트 → POST /api/auth/logout → JTI를 blacklist:{jti}에 등록
```

### STOMP 인증

```
WebSocket 핸드셰이크 시 Authorization 헤더 또는 ?token= 파라미터로 JWT 전달
JwtHandshakeInterceptor가 검증 후 attributes에 userId, nickname 저장
유효하지 않으면 HTTP 401 반환 (연결 거부)
```

### Stateless 보장 체크리스트

- [x] `SessionCreationPolicy.STATELESS` 설정
- [x] `HttpSession` 직접 참조 제거
- [x] 인스턴스 로컬 캐시 대신 Redis 사용
- [x] 로드밸런서 Sticky Session 불필요

---

## 7. 수평 확장 설계 (#40)

- **Stateless 서버:** JWT + Redis로 모든 상태 외부화
- **Redis Pub/Sub:** STOMP 세션 간 메시지 라우팅 (단일 인스턴스 현재, Kafka 전환 가능)
- **MongoDB Replica Set:** 읽기 부하 분산 (`readPreference: secondaryPreferred`)

---

## 8. 마이그레이션 단계

| 단계 | 기간 | 내용 |
|------|------|------|
| 1. 멀티모듈 추출 | 1주 | `common-domain` 분리, Gradle 재구성 |
| 2. MongoDB 추가 | 1주 | 새 메시지를 MongoDB에만 저장 |
| 3. Redis 읽음 이관 | 1주 | Lua Script 원자 처리 도입 |
| 4. JWT 인증 전환 | 1주 | Stateless 서버 완성 |

**롤백 전략:** 각 단계는 `@ConditionalOnProperty`로 Feature Flag 제어. 설정 변경만으로 이전 구현 즉시 복귀.

---

## 9. 성능 목표 및 모니터링

| 지표 | 목표 |
|------|------|
| 채팅방 동시 접속 | 1,000명 이상 |
| 메시지 목록 P99 응답 시간 | ≤ 200ms |
| MongoDB 슬로우 쿼리 임계값 | 100ms |
| JPA N+1 감지 임계값 | 5회 초과 시 WARN |
