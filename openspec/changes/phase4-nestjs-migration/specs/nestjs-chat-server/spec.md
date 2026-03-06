## ADDED Requirements

### Requirement: NestJS chat-server DDD 4계층 구조
chat-server는 NestJS 프레임워크로 구현하며, DDD 4계층 구조(Presentation → Application → Domain → Infrastructure)를 유지해야 한다(SHALL). 각 계층은 NestJS Module 시스템으로 분리한다.

**계층 매핑:**

| 계층 | Spring Boot | NestJS |
|------|-------------|--------|
| Presentation | @RestController, @MessageMapping | @Controller, WebSocket Gateway |
| Application | @Service + @Transactional | @Injectable + TypeORM QueryRunner |
| Domain | POJO Entity, Interface Repository | 순수 TypeScript 클래스, Interface |
| Infrastructure | JPA Repository 구현, Config | TypeORM Repository 구현, Mongoose, Config |

#### Scenario: 계층 간 단방향 의존
- **WHEN** Presentation 계층의 Controller가 데이터를 조회할 때
- **THEN** Application Service를 통해서만 접근하며, Repository를 직접 호출하지 않아야 한다

#### Scenario: Domain 계층 인프라 독립성
- **WHEN** Domain 계층의 Entity와 Repository Interface를 컴파일할 때
- **THEN** TypeORM, Mongoose, NestJS 등 외부 기술에 대한 import가 없어야 한다

#### Scenario: Entity 직접 반환 금지
- **WHEN** Controller가 API 응답을 반환할 때
- **THEN** Domain Entity가 아닌 Application DTO를 사용해야 한다

---

### Requirement: REST API 계약 준수
chat-server의 모든 REST API는 SDD 05-interface.md에 정의된 엔드포인트, 요청/응답 형식, HTTP 상태 코드를 그대로 준수해야 한다(SHALL).

**포함 엔드포인트:**
- 유저: POST/GET `/api/users`, GET `/api/users/active`, PUT `/api/users/{id}/activity`
- 채팅방: POST/GET `/api/chat-rooms`, POST `/api/chat-rooms/{id}/join`, POST `/api/chat-rooms/{id}/leave`
- 메시지: POST `/api/chat-rooms/{id}/messages`, GET `/api/messages/chatroom/{id}`
- 읽음: POST `/api/read-status`, GET `/api/chat/unread-count/{chatRoomId}`
- 파일: POST `/api/chat-rooms/{id}/messages/upload` (multipart/form-data)

#### Scenario: ApiResponse Wrapper 형식
- **WHEN** 클라이언트가 REST API를 호출할 때
- **THEN** 응답은 `{ success: boolean, data: any, error: { code: string, message: string } | null }` 형식이어야 한다

#### Scenario: 기존 클라이언트 호환성
- **WHEN** 기존 React 클라이언트(변경 없음)가 NestJS chat-server에 요청할 때
- **THEN** 모든 API가 Spring Boot 서버와 동일하게 동작해야 한다

---

### Requirement: STOMP WebSocket 프로토콜 유지
chat-server는 STOMP 프로토콜 over WebSocket을 지원하여, 기존 클라이언트의 `@stomp/stompjs` 코드가 변경 없이 동작해야 한다(SHALL).

**STOMP 엔드포인트:**
- `/ws` — SockJS 폴백 (브라우저용)
- `/ws-stomp` — 네이티브 WebSocket (k6 부하테스트용)

**STOMP 목적지:**
- 발행: `/app/chat.message`, `/app/chat.read`, `/app/chat.addUser`
- 구독: `/topic/chatroom.{id}`, `/topic/chatroom.{id}.read-status`

#### Scenario: STOMP CONNECT 핸드셰이크
- **WHEN** 클라이언트가 `/ws-stomp`로 WebSocket 연결 후 STOMP CONNECT 프레임을 전송할 때
- **THEN** 서버가 CONNECTED 프레임으로 응답하고 STOMP 세션이 수립된다

#### Scenario: 메시지 발행 및 브로드캐스트
- **WHEN** 클라이언트가 `/app/chat.message`로 메시지를 SEND할 때
- **THEN** `/topic/chatroom.{roomId}`를 구독 중인 모든 클라이언트가 MESSAGE 프레임을 수신한다

#### Scenario: 읽음 상태 실시간 전파
- **WHEN** 클라이언트가 `/app/chat.read`로 읽음 처리를 SEND할 때
- **THEN** `/topic/chatroom.{roomId}.read-status`를 구독 중인 모든 클라이언트가 읽음 상태 업데이트를 수신한다

---

### Requirement: MySQL 연동 (TypeORM)
chat-server는 TypeORM을 사용하여 MySQL에 유저, 채팅방, 멤버십 데이터를 저장해야 한다(SHALL). 기존 MySQL 스키마와 동일한 테이블 구조를 사용한다.

**테이블:** `users`, `chat_rooms`, `chat_room_members`, `messages`, `attachments`

#### Scenario: 기존 MySQL 스키마 호환
- **WHEN** NestJS chat-server가 기존 MySQL 데이터베이스에 연결할 때
- **THEN** 기존 Spring Boot 서버가 생성한 데이터를 정상적으로 읽고 쓸 수 있어야 한다

#### Scenario: 낙관적 락 유지
- **WHEN** 두 클라이언트가 동시에 같은 ChatRoom을 수정할 때
- **THEN** TypeORM의 `@VersionColumn`을 통해 충돌이 감지되고, 나중 요청에 OptimisticLockVersionMismatchError가 발생한다

---

### Requirement: MongoDB 비동기 쓰기
chat-server는 실시간 메시지 저장 시 MongoDB에 비동기로 메시지를 기록해야 한다(SHALL). Node.js의 비동기 특성을 활용하여 fire-and-forget 패턴으로 처리한다.

#### Scenario: MongoDB 비동기 쓰기 성공
- **WHEN** 클라이언트가 채팅 메시지를 전송할 때
- **THEN** MySQL에 동기적으로 저장한 후, MongoDB에 비동기로 비정규화된 메시지를 저장한다

#### Scenario: MongoDB 쓰기 실패 시 MySQL 유지
- **WHEN** MongoDB가 일시적으로 사용 불가하여 비동기 쓰기가 실패할 때
- **THEN** MySQL의 메시지 데이터는 정상 유지되며, 에러 로그만 기록한다

---

### Requirement: Redis 읽음 상태 처리
chat-server는 Redis를 사용하여 읽음 상태의 원자적 카운트를 처리해야 한다(SHALL).

#### Scenario: 읽음 상태 원자적 업데이트
- **WHEN** 사용자가 채팅방의 메시지를 읽을 때
- **THEN** Redis에서 해당 사용자의 읽음 위치가 원자적으로 갱신된다

---

### Requirement: GlobalExceptionFilter
chat-server는 NestJS ExceptionFilter를 통해 모든 예외를 일관된 형식으로 처리해야 한다(SHALL).

**오류 코드:** `USER_NOT_FOUND`, `ROOM_NOT_FOUND`, `ROOM_NOT_ACTIVE`, `INVALID_NICKNAME`, `INVALID_ROOM_NAME`, `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`

#### Scenario: 정의된 오류 코드 반환
- **WHEN** 존재하지 않는 유저 ID로 API 호출 시
- **THEN** HTTP 404와 함께 `{ success: false, data: null, error: { code: "USER_NOT_FOUND", message: "..." } }` 형식으로 응답한다

#### Scenario: 예상치 못한 예외 처리
- **WHEN** 서버 내부 오류가 발생할 때
- **THEN** HTTP 500과 함께 일관된 에러 응답을 반환하며, 스택 트레이스는 노출하지 않는다

---

### Requirement: 입력값 검증 (class-validator)
chat-server는 `class-validator`와 NestJS `ValidationPipe`를 사용하여 요청 DTO의 입력값을 검증해야 한다(SHALL).

**검증 규칙:**
- 닉네임: 2-50자, 영문/한글/숫자/언더스코어
- 채팅방 이름: 2-100자
- 메시지 내용: 최대 5000자
- 이미지 파일: 최대 5MB (프로필), 7.5MB (메시지), JPEG/PNG/GIF/WebP

#### Scenario: 닉네임 형식 검증
- **WHEN** 1자 닉네임으로 유저 생성 요청 시
- **THEN** HTTP 400과 함께 `INVALID_NICKNAME` 오류 코드가 반환된다

#### Scenario: 파일 크기 초과 검증
- **WHEN** 6MB 이미지 파일로 프로필 업로드 시
- **THEN** HTTP 400과 함께 `FILE_TOO_LARGE` 오류 코드가 반환된다
