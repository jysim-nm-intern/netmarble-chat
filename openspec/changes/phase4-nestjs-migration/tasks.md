## 1. 기존 서버 보존 및 폴더 리네이밍

- [x] 1.1 `chat-server/` → `chat-server-spring/` 리네이밍
- [x] 1.2 `api-server/` → `api-server-spring/` 리네이밍
- [x] 1.3 docker-compose.yml 내 기존 빌드 컨텍스트 경로가 리네이밍 후에도 유효한지 확인

## 2. SDD 문서 업데이트 (SDD First)

- [x] 2.1 `docs/sdd/01-project-overview.md` — 기술 스택 테이블 변경 (Java 17/Spring Boot → Node.js 20/NestJS, JPA → TypeORM/Mongoose, JUnit → Jest)
- [x] 2.2 `docs/sdd/04-data-model.md` — JPA/Hibernate 관련 언급을 TypeORM/Mongoose로 변경
- [x] 2.3 `docs/sdd/05-interface.md` — chat-server/api-server 서버 경로 및 기술 참조 확인·수정
- [x] 2.4 `docs/sdd/06-architecture.md` — 백엔드 계층 구조, 패키지 트리를 NestJS 구조로 전면 재작성
- [x] 2.5 `docs/sdd/07-non-functional.md` — Spring 관련 성능/보안 항목을 NestJS 기준으로 수정
- [x] 2.6 `docs/sdd/08-test-specs.md` — 테스트 프레임워크 변경 (JUnit/Mockito → Jest/@nestjs/testing), 실행 명령어 수정
- [x] 2.7 `docs/sdd/09-ai-guide.md` — AI 코드 생성 가이드를 NestJS/TypeScript 기준으로 전면 재작성

## 3. 프로젝트 루트 문서 업데이트

- [x] 3.1 `CLAUDE.md` — 핵심 스택, 빌드/테스트 명령어, 백엔드 규칙을 NestJS 기준으로 수정
- [x] 3.2 `README.md` — 프로젝트 소개, 기술 스택, 실행 방법을 NestJS 기준으로 수정
- [x] 3.3 `database-setup.md` — Spring Boot 자동 생성 → TypeORM 마이그레이션 방식으로 수정
- [x] 3.4 `docs/system-design.md` — Spring/Java 참조 전면 수정 (26회 언급)

## 4. .github 및 클라이언트 규칙 업데이트

- [x] 4.1 `.github/copilot-instructions.md` — 기술 스택, DDD 계층, 테스트 명령어를 NestJS 기준으로 수정
- [x] 4.2 `.github/workflows/ci-server.yml` — Gradle 빌드 → npm 빌드/테스트로 전환
- [x] 4.3 `.github/workflows/ci-api-server.yml` — Gradle 빌드 → npm 빌드/테스트로 전환
- [x] 4.4 `client/.claude/rules/anti_pattern.md` — Spring Security 언급을 NestJS Guard/Passport로 변경
- [x] 4.5 `client/.claude/rules/skills.md` — Spring Boot 내장 브로커 → NestJS STOMP 브로커로 변경

## 5. api-server NestJS 프로젝트 구축

- [x] 5.1 NestJS 프로젝트 생성 (`nest new api-server`) + TypeScript 설정
- [x] 5.2 @nestjs/mongoose 연동 및 MongoDB 연결 설정
- [x] 5.3 Infrastructure 계층 — MessageDocument, ReadStatusDocument (Mongoose Schema)
- [x] 5.4 Infrastructure 계층 — MessageMongoRepository, ReadStatusMongoRepository
- [x] 5.5 Application 계층 — MessageQueryService (cursor-based 페이지네이션)
- [x] 5.6 Application 계층 — DTO (MessageResponse, CursorPageResponse)
- [x] 5.7 Presentation 계층 — MessageHistoryController (GET /api/messages/history/{chatRoomId})
- [x] 5.8 Presentation 계층 — HealthController (GET /health)
- [x] 5.9 GlobalExceptionFilter 구현
- [x] 5.10 Jest 단위 테스트 작성 (MessageQueryService, Controller)
- [x] 5.11 Dockerfile 작성 (Node.js 20 Alpine 멀티스테이지)

## 6. chat-server NestJS 프로젝트 구축 — 기반 설정

- [x] 6.1 NestJS 프로젝트 생성 (`nest new chat-server`) + TypeScript 설정
- [x] 6.2 TypeORM 연동 및 MySQL 연결 설정
- [x] 6.3 @nestjs/mongoose 연동 및 MongoDB 연결 설정
- [x] 6.4 Redis 연동 설정 (ioredis 또는 @nestjs/redis)
- [x] 6.5 STOMP WebSocket 서버 설정 (stomp-broker-js + ws)

## 7. chat-server Domain 계층

- [x] 7.1 Domain Model — User Entity (순수 TypeScript, 비즈니스 로직 포함)
- [x] 7.2 Domain Model — ChatRoom Entity (validateName, addMember, removeMember 등)
- [x] 7.3 Domain Model — ChatRoomMember Entity (leave, rejoin, updateReadStatus 등)
- [x] 7.4 Domain Model — Message Entity (validateContent, softDelete, createSystemMessage 등)
- [x] 7.5 Domain Model — Attachment Entity
- [x] 7.6 Domain Repository — Interface 정의 (UserRepository, ChatRoomRepository, MessageRepository, ChatRoomMemberRepository, AttachmentRepository)
- [x] 7.7 Domain Service — UserDomainService

## 8. chat-server Infrastructure 계층

- [x] 8.1 TypeORM Entity 매핑 (UserEntity, ChatRoomEntity, ChatRoomMemberEntity, MessageEntity, AttachmentEntity)
- [x] 8.2 TypeORM Repository 구현 (TypeormUserRepository, TypeormChatRoomRepository 등)
- [x] 8.3 MongoDB Document 매핑 (ChatMessageDocument)
- [x] 8.4 MongoDB Repository 구현 (ChatMessageMongoRepository)
- [x] 8.5 Redis Service 구현 (ReadStatusRedisService)
- [x] 8.6 Config 모듈 (TypeORM, Mongoose, Redis, WebSocket)

## 9. chat-server Application 계층

- [x] 9.1 DTO 정의 (CreateUserRequest, UserResponse, SendMessageRequest, MessageResponse 등 12개)
- [x] 9.2 UserApplicationService
- [x] 9.3 ChatRoomApplicationService
- [x] 9.4 MessageApplicationService (MongoDB 비동기 쓰기 포함)
- [x] 9.5 ReadStatusApplicationService

## 10. chat-server Presentation 계층

- [x] 10.1 UserController (POST/GET /api/users, multipart 이미지 업로드)
- [x] 10.2 ChatRoomController (POST/GET /api/chat-rooms, join, leave, members)
- [x] 10.3 ChatController (unread-count, search)
- [x] 10.4 MessageController (GET /api/messages/chatroom/{id}, DELETE)
- [x] 10.5 ReadStatusController
- [x] 10.6 HealthController
- [x] 10.7 WebSocketMessageGateway (STOMP /app/chat.message, /app/chat.addUser, /app/chat.read)
- [x] 10.8 GlobalExceptionFilter
- [x] 10.9 ValidationPipe 설정 (class-validator)

## 11. chat-server 테스트

- [x] 11.1 Domain 단위 테스트 (User, ChatRoom, ChatRoomMember, Message Entity)
- [x] 11.2 Domain Service 단위 테스트 (UserDomainService)
- [x] 11.3 Application Service 단위 테스트 (UserApplicationService, ChatRoomApplicationService, MessageApplicationService, ReadStatusApplicationService)
- [x] 11.4 Controller 단위 테스트 (HealthController)
- [x] 11.5 Dockerfile 작성 (Node.js 20 Alpine 멀티스테이지)

## 12. Docker 및 CI 통합

- [x] 12.1 docker-compose.yml — server 서비스 빌드 컨텍스트를 NestJS chat-server로 변경
- [x] 12.2 docker-compose.yml — api-server 서비스 빌드 컨텍스트를 NestJS api-server로 변경
- [x] 12.3 docker-compose.yml — 환경변수 전환 (SPRING_PROFILES_ACTIVE → NODE_ENV 등)
- [x] 12.4 docker-compose.yml — scale 프로파일 chat-server-1, chat-server-2 NestJS 전환
- [x] 12.5 docker-compose.yml — 헬스체크 변경 (wget actuator → curl /health)
- [x] 12.6 docker-compose.yml — load 프로파일 서버 NestJS 전환

## 13. 검증 및 성능 비교

- [x] 13.1 `docker compose up`으로 전체 시스템 기동 확인
- [ ] 13.2 기존 React 클라이언트에서 전 기능 수동 테스트
- [ ] 13.3 Playwright E2E 테스트 실행 및 전체 통과 확인
- [ ] 13.4 k6 부하테스트 실행 (NestJS 서버 대상)
- [ ] 13.5 Java vs Node.js 성능 비교 리포트 작성 (동일 k6 시나리오)
