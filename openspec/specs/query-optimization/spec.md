## ADDED Requirements

### Requirement: JPA N+1 문제 해소 — Fetch Join 및 DTO Projection 가이드
시스템의 모든 JPA Repository 구현체는 연관 엔티티 조회 시 N+1 쿼리가 발생하지 않도록 반드시(MUST) Fetch Join 또는 DTO Projection 전략 중 하나를 적용해야 한다.

**적용 우선순위:**
1. **목록 조회(List):** DTO Projection 우선 (`SELECT new dto.Foo(r.id, r.name) FROM Room r JOIN r.participants p`)
2. **단일 엔티티 상세:** `JOIN FETCH` 적용 (`@Query("SELECT r FROM Room r JOIN FETCH r.participants WHERE r.id = :id")`)
3. **집계/통계:** Native Query 또는 MongoDB Aggregation Pipeline

**금지 패턴:**
- `@ManyToOne(fetch = FetchType.EAGER)` 기본 설정 — LAZY로 통일
- 동일 엔티티에 `@EntityGraph` + `JOIN FETCH` 혼용 (MultipleBagFetchException 위험)
- 루프 내 Repository 메서드 호출 (`for(room : rooms) { room.getParticipants() }` 형태)

#### Scenario: 방 목록 조회 시 N+1 미발생 검증
- **WHEN** `/api/rooms` 엔드포인트로 방 목록을 조회할 때
- **THEN** 실행되는 SQL 쿼리 수는 참여자 수와 무관하게 단일 쿼리(또는 2개 이내)여야 한다

#### Scenario: DTO Projection으로 필요한 컬럼만 조회
- **WHEN** 방 목록 DTO 조회 쿼리가 실행될 때
- **THEN** SELECT 절에는 화면 표시에 필요한 컬럼만 포함되어야 하며 전체 엔티티를 로드하지 않아야 한다

#### Scenario: LAZY 로딩 기본 설정
- **WHEN** Room 엔티티의 연관 컬렉션(`participants`, `messages`)에 접근할 때
- **THEN** 명시적 JOIN FETCH 없이는 프록시 상태를 유지하고 즉시 로딩하지 않아야 한다

---

### Requirement: Redis 기반 읽음 상태 원자성 보장
시스템은 동시에 여러 유저가 동일 메시지를 읽을 때 읽음 카운트가 정확하게 집계되도록 Redis 원자 연산을 사용해야(SHALL) 한다.

**구현 계약:**
- 읽음 등록 키: `read:{messageId}:users` (Redis Set) — 중복 방지
- 읽음 카운트 키: `read:{messageId}:count` (Redis String/Hash)
- 원자적 처리: Lua Script로 SADD + INCR을 단일 작업으로 실행
- TTL: 메시지 키는 7일 후 자동 만료 (`EXPIRE`)
- MongoDB 동기화: 5초 간격 배치 스케줄러 (`@Scheduled`)

**Lua Script 예시:**
```lua
local added = redis.call("SADD", KEYS[1], ARGV[1])
if added == 1 then
  return redis.call("INCR", KEYS[2])
end
return redis.call("GET", KEYS[2])
```

#### Scenario: 동일 유저의 중복 읽음 방지
- **WHEN** 유저 A가 메시지 M을 이미 읽은 상태에서 다시 읽음 이벤트를 발생시키면
- **THEN** 시스템은 읽음 카운트를 증가시키지 않아야 한다

#### Scenario: 동시 다수 유저 읽음 처리
- **WHEN** 100명의 유저가 동시에 동일 메시지의 읽음 이벤트를 전송하면
- **THEN** 시스템은 최종 읽음 카운트가 정확히 100이 되도록 보장해야 한다

#### Scenario: Redis 장애 시 MongoDB fallback
- **WHEN** Redis 연결이 불가능한 상태에서 읽음 이벤트가 발생하면
- **THEN** 시스템은 MongoDB `$inc` 연산으로 fallback 처리하고 에러 로그를 남겨야 한다

#### Scenario: MongoDB 동기화 배치 실행
- **WHEN** 5초 간격 스케줄러가 실행될 때
- **THEN** 시스템은 Redis에 캐시된 읽음 카운트를 MongoDB `messages.readCount`에 반영해야 한다

---

### Requirement: 쿼리 성능 모니터링 기준 수립
시스템은 슬로우 쿼리를 자동으로 감지하고 기록해야(SHALL) 한다.

**기준:**
- JPA: Hibernate Statistics 활성화, 단일 요청에서 쿼리 5회 초과 시 WARN 로그
- MongoDB: `slowOpThresholdMs: 100` 설정, 100ms 초과 쿼리 자동 기록
- API 응답 시간 P99 목표: 200ms 이하 (메시지 목록 조회 기준)

#### Scenario: N+1 자동 감지 경고
- **WHEN** 단일 HTTP 요청 처리 중 JPA 쿼리가 5회를 초과하면
- **THEN** 시스템은 해당 요청의 URL, 쿼리 수, 총 실행 시간을 WARN 레벨로 로깅해야 한다

#### Scenario: MongoDB 슬로우 쿼리 기록
- **WHEN** MongoDB 쿼리 실행 시간이 100ms를 초과하면
- **THEN** 시스템은 해당 쿼리의 컬렉션명, 필터, 실행 계획을 로그에 기록해야 한다
