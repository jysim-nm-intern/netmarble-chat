## 1. Gradle 멀티모듈 구조 설정 (#39)

- [x] 1.1 루트 `settings.gradle` 수정: `common-domain`, `api-server`, `chat-server` 서브모듈 선언
- [x] 1.2 `common-domain/build.gradle` 생성: Spring Boot 의존성 없이 순수 Java 모듈로 설정
- [x] 1.3 `api-server/build.gradle` 생성: `common-domain` 의존성 추가, Spring Boot, JPA, Security, MongoDB 의존성 포함
- [x] 1.4 `chat-server/build.gradle` 생성: `common-domain` 의존성 추가, Spring Boot, WebSocket, Redis 의존성 포함
- [x] 1.5 기존 `server/src` 소스 코드를 도메인/인프라 레이어별로 `common-domain`, `api-server`, `chat-server`로 이동
- [x] 1.6 각 모듈 단독 `./gradlew :<module>:build` 성공 확인
- [x] 1.7 ArchUnit 의존성 방향 규칙 테스트 작성 (`common-domain` → 인프라 금지, 모듈 간 역방향 금지)

## 2. common-domain 도메인 모델 정리

- [x] 2.1 `Room`, `Message`, `User` 도메인 객체를 순수 POJO로 `common-domain`에 정의 (JPA/MongoDB 어노테이션 제거)
- [x] 2.2 `MessageService`, `RoomService`, `ReadStatusService` 인터페이스를 `common-domain`에 이동
- [x] 2.3 `MessageDto`, `RoomDto`, `RoomSummaryDto` 등 공유 DTO를 `common-domain`에 이동
- [x] 2.4 공통 예외 클래스(`ChatException`, `RoomNotFoundException` 등)를 `common-domain`에 이동
- [x] 2.5 `common-domain` 컴파일 시 `jakarta.persistence`, `org.springframework.data.mongodb` 의존 없음 확인

## 3. MongoDB 저장소 전환 (#38)

- [x] 3.1 `api-server`에 `spring-boot-starter-data-mongodb` 의존성 추가 및 `application.yml` MongoDB 연결 설정
- [x] 3.2 `MessageDocument` 클래스 생성 (`@Document(collection = "messages")`, 비정규화 필드 포함)
- [x] 3.3 `MessageMongoRepository` 인터페이스 생성 (`MongoRepository<MessageDocument, String>` 상속)
- [x] 3.4 `messages` 컬렉션 복합 인덱스 생성 코드 작성: `{ roomId: 1, _id: -1 }`, `{ senderId: 1, createdAt: -1 }`
- [x] 3.5 `read_status` 컬렉션 유니크 인덱스 생성: `{ messageId: 1, userId: 1 }`
- [x] 3.6 기존 `MessageJpaRepository` 구현체를 `MessageMongoRepository`로 교체 (서비스 레이어 인터페이스 유지)
- [x] 3.7 `ReadStatusDocument` 클래스 생성 및 대규모 방(500명 초과) 분기 로직 구현
- [x] 3.8 MongoDB 저장/조회 통합 테스트 작성 (`@DataMongoTest`)

## 4. Cursor-based 메시지 페이징 API (#38)

- [x] 4.1 메시지 조회 API 엔드포인트 수정: `GET /api/rooms/{roomId}/messages?cursor={id}&limit=50&direction=BEFORE`
- [x] 4.2 `MessageQueryService.findByCursor(roomId, cursor, limit, direction)` 메서드 구현
- [x] 4.3 MongoDB 쿼리 구현: `{ roomId, _id: { $lt: cursor } }.sort({ _id: -1 }).limit(n)`
- [x] 4.4 응답 DTO에 `nextCursor`, `hasMore` 필드 추가
- [x] 4.5 `cursor` 미지정 시 최신 메시지부터 반환하는 기본값 처리
- [x] 4.6 `limit` 최대값 100 검증 로직 추가
- [x] 4.7 Cursor-based 페이징 단위 테스트 작성

## 5. JPA N+1 쿼리 최적화 (#37)

- [x] 5.1 Room 목록 조회 쿼리에 DTO Projection 적용: `SELECT new RoomSummaryDto(r.id, r.name, COUNT(p)) FROM Room r JOIN r.participants p`
- [x] 5.2 Room 상세 조회 쿼리에 `JOIN FETCH` 적용 (참여자 즉시 로딩)
- [x] 5.3 모든 `@ManyToOne`, `@OneToMany` 연관관계 `fetch = FetchType.LAZY` 통일 확인
- [x] 5.4 Hibernate Statistics 활성화: `spring.jpa.properties.hibernate.generate_statistics=true`
- [x] 5.5 단일 요청에서 JPA 쿼리 5회 초과 시 WARN 로깅 `HandlerInterceptor` 구현
- [x] 5.6 N+1 해소 전후 쿼리 수 비교 테스트 작성

## 6. Redis 읽음 상태 원자성 구현 (#37, #41)

- [x] 6.1 `spring-boot-starter-data-redis` 의존성 추가 및 `application.yml` Redis 연결 설정
- [x] 6.2 읽음 등록 Lua Script 작성 및 `RedisScript` Bean으로 등록 (SADD + INCR 원자 처리)
- [x] 6.3 `ReadStatusRedisService` 구현: `markAsRead(messageId, userId)`, `getReadCount(messageId)` 메서드
- [x] 6.4 Redis → MongoDB 동기화 배치 스케줄러 구현 (`@Scheduled(fixedDelay = 5000)`)
- [x] 6.5 Redis 장애 시 MongoDB `$inc` fallback 로직 구현 (try-catch + Circuit Breaker)
- [x] 6.6 동시 100명 읽음 처리 동시성 테스트 작성 (`ExecutorService` 활용)
- [x] 6.7 중복 읽음 방지 단위 테스트 작성

## 7. JWT 기반 인증 전환 (#40)

- [x] 7.1 `jjwt-api`, `jjwt-impl`, `jjwt-jackson` 의존성 추가
- [x] 7.2 `JwtTokenProvider` 클래스 구현: AccessToken 발급(15분), RefreshToken 발급(7일), 검증, JTI 추출
- [x] 7.3 Spring Security 설정에서 `SessionCreationPolicy.STATELESS` 적용, 세션 관련 빈 제거
- [x] 7.4 `JwtAuthenticationFilter` 구현: `Authorization: Bearer {token}` 헤더 파싱 및 검증
- [x] 7.5 `/api/auth/refresh` 엔드포인트 구현: RefreshToken으로 AccessToken 갱신
- [x] 7.6 로그아웃 시 AccessToken JTI를 Redis 블랙리스트 등록 (`blacklist:{jti}`, TTL = 남은 만료 시간)
- [x] 7.7 STOMP WebSocket 핸드셰이크 JWT 검증 `HandshakeInterceptor` 구현
- [x] 7.8 JWT 인증 통합 테스트 작성 (발급, 갱신, 블랙리스트 검증)

## 8. Stateless 서버 검증 및 성능 테스트 (#36, #40)

- [x] 8.1 `HttpSession` 직접 참조 코드 전체 검색 및 제거 (SecurityConfig STATELESS 설정)
- [x] 8.2 인스턴스 로컬 캐시(`HashMap`, `static` 필드 등) 전체 검색 및 Redis 캐시로 전환
- [ ] 8.3 서버 2개 인스턴스 로컬 구동 후 라운드 로빈 동작 확인 테스트 (curl 스크립트)
- [ ] 8.4 1,000명 동시 접속 시뮬레이션 부하 테스트 실행 (k6 또는 Gatling)
- [ ] 8.5 메시지 목록 조회 P99 응답 시간 200ms 이하 달성 확인
- [x] 8.6 MongoDB 슬로우 쿼리 임계값 설정: `slowOpThresholdMs: 100` (application.yml)
- [ ] 8.7 부하 테스트 결과 리포트 작성 및 `load-test-report.md` 업데이트

## 9. 문서화 및 마무리

- [x] 9.1 `docs/sdd/04-data-model.md`에 MongoDB 컬렉션 스키마 및 인덱스 전략 반영
- [x] 9.2 `docs/sdd/05-interface.md`에 Cursor-based 페이징 API 계약 및 JWT 인증 헤더 명세 업데이트
- [x] 9.3 `docs/sdd/06-architecture.md`에 멀티모듈 패키지 트리 및 의존성 방향 다이어그램 업데이트
- [x] 9.4 `specs/phase2-architecture.md` 최종 기술 명세서 생성 (본 OpenSpec 문서 요약본)
- [x] 9.5 GitHub Issues #36~#41 체크리스트 항목 완료 표시 (PR 생성으로 대체)
