## MODIFIED Requirements

### Requirement: Gradle 멀티모듈 구조 정의
시스템은 Gradle 멀티모듈 대신 NestJS 독립 프로젝트 구조로 전환한다. `chat-server`와 `api-server`는 각각 독립된 NestJS 프로젝트(package.json)로 구성되며, 공유 도메인 코드는 각 프로젝트 내부에 포함한다(SHALL).

**프로젝트 구조:**

| 프로젝트 | 역할 | 의존 |
|---------|------|------|
| `server/chat-server/` | 실시간 채팅 서버 (STOMP + REST + MySQL + MongoDB + Redis) | 독립 |
| `server/api-server/` | REST API 서버 (MongoDB 읽기 전용) | 독립 |

**기존 Java 서버 보존:**
- `server/chat-server-spring/` — 기존 Spring Boot chat-server (리네이밍 보존)
- `server/api-server-spring/` — 기존 Spring Boot api-server (리네이밍 보존)

#### Scenario: chat-server 독립 빌드
- **WHEN** `cd server/chat-server && npm run build`를 실행할 때
- **THEN** api-server 없이 독립적으로 빌드가 성공해야 한다

#### Scenario: api-server 독립 빌드
- **WHEN** `cd server/api-server && npm run build`를 실행할 때
- **THEN** chat-server 없이 독립적으로 빌드가 성공해야 한다

#### Scenario: api-server와 chat-server 간 직접 의존 금지
- **WHEN** api-server의 소스에서 chat-server 내부 모듈을 import하면
- **THEN** TypeScript 컴파일이 실패해야 한다 (별도 패키지이므로 자연적으로 불가)

---

### Requirement: 모듈 간 의존성 방향 규칙
chat-server와 api-server는 서로 직접 의존하지 않으며, MongoDB `messages` 컬렉션을 통해서만 데이터를 공유해야 한다(SHALL). 각 프로젝트 내부에서는 NestJS Module 시스템을 통해 계층 간 의존성을 관리한다.

#### Scenario: chat-server ↔ api-server 간 직접 의존 금지
- **WHEN** chat-server가 api-server의 코드를 직접 참조하려 할 때
- **THEN** 별도 npm 프로젝트이므로 import가 불가능하다

---

### Requirement: 공유 도메인 엔티티 관리 규칙
각 서버 프로젝트 내부의 Domain 계층은 외부 기술(TypeORM, Mongoose, NestJS 등)에 독립적인 순수 TypeScript 클래스로 정의해야 한다(SHALL). 영속성 매핑은 Infrastructure 계층에서 처리한다.

#### Scenario: 도메인 객체 인프라 독립성 검증
- **WHEN** Domain 계층의 Entity 클래스를 확인할 때
- **THEN** `typeorm`, `@nestjs/mongoose`, `@nestjs/common` 등의 import가 없어야 한다

#### Scenario: 인프라 매핑 위치
- **WHEN** TypeORM `@Entity` 또는 Mongoose `@Schema` 데코레이터가 필요할 때
- **THEN** 해당 클래스는 반드시 `infrastructure/` 디렉토리 내에 위치해야 한다

---

### Requirement: 모듈 독립 배포 준비
각 서버(chat-server, api-server)는 독립적으로 실행 가능한 Node.js 애플리케이션으로 패키징되어야 한다(SHALL).

#### Scenario: chat-server 독립 실행
- **WHEN** `node server/chat-server/dist/main.js`를 실행할 때
- **THEN** chat-server가 정상 구동되어 REST API와 STOMP WebSocket에 응답해야 한다

#### Scenario: api-server 독립 실행
- **WHEN** `node server/api-server/dist/main.js`를 실행할 때
- **THEN** api-server가 정상 구동되어 메시지 이력 REST API에 응답해야 한다
