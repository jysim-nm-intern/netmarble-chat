## ADDED Requirements

### Requirement: Stateless 서버 설계 원칙
시스템의 모든 서버 인스턴스는 요청 처리 시 로컬 서버 메모리에 저장된 상태에 의존하지 않아야(SHALL) 한다. 동일한 클라이언트의 연속 요청이 서로 다른 서버 인스턴스로 전달되어도 동일하게 처리되어야 한다.

**필수 조건:**
- Spring Security 세션 생성 정책: `SessionCreationPolicy.STATELESS`
- `HttpSession` 직접 참조 코드 금지
- 인스턴스 로컬 캐시 금지 (Redis 분산 캐시 사용)
- STOMP 세션 상태는 Redis Pub/Sub 또는 공유 브로커를 통해 관리

#### Scenario: 서로 다른 서버 인스턴스의 요청 처리
- **WHEN** 클라이언트가 첫 번째 요청을 서버 인스턴스 A에, 두 번째 요청을 서버 인스턴스 B에 보내면
- **THEN** 두 요청 모두 동일한 결과를 반환해야 하며 인스턴스 불일치로 인한 오류가 없어야 한다

#### Scenario: 서버 재시작 후 인증 상태 유지
- **WHEN** 서버 인스턴스가 재시작된 후 유효한 JWT를 가진 클라이언트가 요청을 보내면
- **THEN** 서버는 해당 JWT를 검증하여 인증된 응답을 반환해야 한다

---

### Requirement: JWT 기반 인증 전환
시스템은 HTTP 세션 기반 인증을 JWT(JSON Web Token) 기반 인증으로 전환해야(SHALL) 한다.

**토큰 규격:**
- AccessToken: 유효기간 15분, 서명 알고리즘 HS256, 페이로드에 `userId`, `nickname`, `roles` 포함
- RefreshToken: 유효기간 7일, Redis에 `refresh:{userId}` 키로 저장
- 로그아웃: AccessToken JTI를 Redis 블랙리스트(`blacklist:{jti}`)에 등록, 만료 시까지 유지

**STOMP 인증:**
- WebSocket 핸드셰이크 시 `Authorization: Bearer {token}` 헤더 검증 (HandshakeInterceptor)
- STOMP CONNECT 프레임의 `Authorization` 헤더도 검증

#### Scenario: 유효한 JWT로 API 접근
- **WHEN** 클라이언트가 유효한 AccessToken을 `Authorization: Bearer` 헤더에 포함하여 요청하면
- **THEN** 서버는 DB 조회 없이 토큰 서명 검증만으로 인증을 완료하고 200 응답을 반환해야 한다

#### Scenario: 만료된 AccessToken으로 갱신 요청
- **WHEN** 클라이언트가 만료된 AccessToken으로 `/api/auth/refresh` 엔드포인트에 유효한 RefreshToken을 제출하면
- **THEN** 서버는 새로운 AccessToken을 발급하고 RefreshToken을 갱신해야 한다

#### Scenario: 로그아웃 후 AccessToken 무효화
- **WHEN** 유저가 로그아웃하고 해당 AccessToken으로 다시 API를 호출하면
- **THEN** 서버는 Redis 블랙리스트를 확인하여 401 Unauthorized를 반환해야 한다

#### Scenario: STOMP 연결 시 JWT 검증
- **WHEN** 클라이언트가 WebSocket 핸드셰이크를 시작하며 유효하지 않은 JWT를 제출하면
- **THEN** 서버는 101 Switching Protocols 대신 401 응답으로 연결을 거부해야 한다

---

### Requirement: Redis 기반 분산 캐시 및 세션 관리
시스템은 서버 인스턴스 간 공유가 필요한 모든 데이터를 Redis에 저장해야(SHALL) 한다.

**Redis 키 설계:**

| 목적 | 키 패턴 | TTL |
|------|---------|-----|
| RefreshToken | `refresh:{userId}` | 7일 |
| AccessToken 블랙리스트 | `blacklist:{jti}` | AccessToken 만료 시까지 |
| 읽음 카운트 | `read:{messageId}:count` | 7일 |
| 읽음 유저 Set | `read:{messageId}:users` | 7일 |
| 채팅방 온라인 유저 수 | `online:{roomId}` | 세션 연결 기간 |

#### Scenario: Redis 분산 캐시 접근
- **WHEN** 서버 인스턴스 A에서 캐시에 데이터를 저장하고 인스턴스 B에서 동일 키로 조회하면
- **THEN** 인스턴스 B는 인스턴스 A가 저장한 값을 반환해야 한다

#### Scenario: TTL 만료 후 키 자동 삭제
- **WHEN** Redis 키에 설정된 TTL이 만료되면
- **THEN** 해당 키는 자동으로 삭제되어 메모리를 반환해야 한다

---

### Requirement: 수평 확장 지원을 위한 로드밸런서 호환성
시스템은 Sticky Session(세션 어피니티) 설정 없이 라운드 로빈 로드밸런서 뒤에 다수의 인스턴스로 배포 가능해야(SHALL) 한다.

#### Scenario: 여러 인스턴스 동시 운영
- **WHEN** 동일한 설정으로 서버 인스턴스 2개 이상이 동시에 실행될 때
- **THEN** 각 인스턴스는 정상 기동되어야 하며 클라이언트 요청을 분산 처리해야 한다

#### Scenario: 인스턴스 추가 시 무중단 확장
- **WHEN** 운영 중 새 서버 인스턴스를 로드밸런서에 추가하면
- **THEN** 기존 클라이언트의 세션 정보 손실 없이 새 인스턴스가 요청을 처리해야 한다
