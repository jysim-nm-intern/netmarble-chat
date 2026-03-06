## Context

현재 시스템은 Spring Boot(Java 17) 기반의 2서버 하이브리드 아키텍처로 운영 중이다:
- **chat-server** (포트 8080): STOMP/WebSocket + REST + MySQL(JPA) + MongoDB(@Async 쓰기) + Redis
- **api-server** (포트 8081): REST + MongoDB(읽기 전용, cursor-based 페이징)

Phase 3까지 부하테스트(k6)를 완료한 상태이며, SDD 명세서가 기술 독립적으로 작성되어 있어 다른 언어로의 마이그레이션이 가능한 구조다.

클라이언트는 React + `@stomp/stompjs`를 사용하며, STOMP 프로토콜과 REST API 계약을 그대로 유지해야 한다.

**제약사항:**
- 클라이언트 코드 변경 금지
- DB 스키마 변경 금지 (MySQL, MongoDB 동일 스키마 유지)
- SDD 05-interface.md의 API 계약 준수 필수
- 기존 Java 서버는 `-spring` 접미사로 보존 (A/B 성능 비교용)

---

## Goals / Non-Goals

**Goals:**
- Spring Boot 2서버 구조를 NestJS로 1:1 전환하여 동일한 기능 제공
- DDD 4계층 구조(Presentation → Application → Domain → Infrastructure)를 NestJS 모듈 시스템으로 유지
- STOMP 프로토콜을 유지하여 클라이언트 무변경 달성
- 기존 Playwright E2E + k6 부하테스트로 마이그레이션 정합성 및 성능 비교 검증
- SDD 문서를 먼저 업데이트하여 "명세 → 구현" 순서 준수

**Non-Goals:**
- socket.io 등 다른 WebSocket 프로토콜로 전환 (STOMP 유지)
- 클라이언트 코드 수정
- DB 스키마 변경 또는 새로운 데이터베이스 도입
- 마이크로서비스 분리 또는 아키텍처 변경 (동일 2서버 구조 유지)
- 프론트엔드 빌드/배포 파이프라인 변경

---

## Decisions

### 1. 프레임워크: NestJS

**선택:** NestJS (TypeScript)
**대안:** Express.js, Fastify, Koa

**근거:**
- Spring Boot와 구조적 1:1 대응 (데코레이터 기반, DI 컨테이너, Module 시스템)
- DDD 4계층을 NestJS Module로 자연스럽게 매핑 가능
- `@Controller`, `@Injectable`, `@Module`이 Spring의 `@RestController`, `@Service`, `@Configuration`과 동일한 역할
- AI 마이그레이션 시 구조적 유사성으로 변환 정확도 향상
- Express.js는 구조를 직접 설계해야 해서 실험 변수가 증가

### 2. ORM: TypeORM (MySQL) + Mongoose (MongoDB)

**선택:** TypeORM + @nestjs/mongoose
**대안:** Prisma + Mongoose, Drizzle + Mongoose

**근거:**
- TypeORM은 JPA와 유사한 데코레이터 기반 Entity 정의 (`@Entity`, `@Column`, `@ManyToOne`)
- Repository 패턴을 기본 지원하여 DDD 인프라 계층 구현에 적합
- `@nestjs/mongoose`는 NestJS 공식 MongoDB 통합 모듈
- Prisma는 코드 생성 방식이라 DDD 도메인 모델과의 간극이 있음

### 3. STOMP WebSocket: stomp-broker-js + ws

**선택:** `stomp-broker-js` (SimpleBroker 대체) + `ws` (WebSocket 서버)
**대안:** socket.io (클라이언트 변경 필요), 직접 STOMP 프레임 파서 구현

**근거:**
- 클라이언트 변경 불가 → STOMP 프로토콜 유지 필수
- `stomp-broker-js`는 Node.js용 경량 STOMP 브로커로, Spring의 SimpleBroker와 동일 역할
  - `/topic` 구독, `/app` 발행 패턴 지원
  - 인메모리 메시지 라우팅
- Scale 모드에서는 RabbitMQ STOMP Relay로 전환 (기존과 동일)
- socket.io는 STOMP과 프로토콜이 다르므로 클라이언트 수정 필요 → 불가

### 4. NestJS DDD 패키지 구조

Spring Boot 패키지 구조를 NestJS 모듈로 1:1 매핑:

```
chat-server/                          (NestJS)
├── src/
│   ├── main.ts                       ← bootstrap
│   ├── app.module.ts                 ← 루트 모듈
│   │
│   ├── presentation/                 ← HTTP/WebSocket 요청 처리
│   │   ├── controller/
│   │   │   ├── user.controller.ts
│   │   │   ├── chat-room.controller.ts
│   │   │   ├── chat.controller.ts
│   │   │   ├── message.controller.ts
│   │   │   ├── read-status.controller.ts
│   │   │   └── health.controller.ts
│   │   ├── gateway/
│   │   │   └── websocket-message.gateway.ts  ← STOMP 메시지 처리
│   │   └── filter/
│   │       └── global-exception.filter.ts
│   │
│   ├── application/                  ← 유스케이스 조율
│   │   ├── service/
│   │   │   ├── user-application.service.ts
│   │   │   ├── chat-room-application.service.ts
│   │   │   ├── message-application.service.ts
│   │   │   └── read-status-application.service.ts
│   │   └── dto/
│   │       ├── create-user.request.ts
│   │       ├── user.response.ts
│   │       └── ...
│   │
│   ├── domain/                       ← 핵심 비즈니스 로직 (외부 기술 무의존)
│   │   ├── model/
│   │   │   ├── user.entity.ts
│   │   │   ├── chat-room.entity.ts
│   │   │   ├── chat-room-member.entity.ts
│   │   │   ├── message.entity.ts
│   │   │   └── attachment.entity.ts
│   │   ├── repository/
│   │   │   ├── user.repository.interface.ts
│   │   │   ├── chat-room.repository.interface.ts
│   │   │   ├── message.repository.interface.ts
│   │   │   └── ...
│   │   └── service/
│   │       └── user-domain.service.ts
│   │
│   └── infrastructure/               ← 외부 기술 구현체
│       ├── persistence/
│       │   ├── typeorm-user.repository.ts
│       │   ├── typeorm-chat-room.repository.ts
│       │   └── ...
│       ├── mongo/
│       │   ├── chat-message.document.ts
│       │   └── chat-message-mongo.repository.ts
│       ├── redis/
│       │   └── read-status-redis.service.ts
│       └── config/
│           ├── websocket.config.ts
│           ├── typeorm.config.ts
│           ├── mongo.config.ts
│           └── redis.config.ts
│
├── test/                             ← Jest 테스트
├── package.json
├── tsconfig.json
├── nest-cli.json
└── Dockerfile
```

```
api-server/                           (NestJS)
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── presentation/
│   │   └── controller/
│   │       ├── message-history.controller.ts
│   │       └── health.controller.ts
│   ├── application/
│   │   ├── service/
│   │   │   └── message-query.service.ts
│   │   └── dto/
│   │       ├── message.response.ts
│   │       └── cursor-page.response.ts
│   └── infrastructure/
│       └── mongo/
│           ├── document/
│           │   ├── message.document.ts
│           │   └── read-status.document.ts
│           └── repository/
│               ├── message-mongo.repository.ts
│               └── read-status-mongo.repository.ts
├── test/
├── package.json
└── Dockerfile
```

### 5. 테스트 전략

**선택:** Jest + @nestjs/testing
**매핑:**

| Spring Boot | NestJS |
|-------------|--------|
| JUnit 5 + Mockito | Jest + jest.mock / @nestjs/testing |
| @SpringBootTest | TestingModule.createTestingModule() |
| @Tag("integration") | describe.skip or jest --testPathPattern |
| H2 인메모리 DB | SQLite 인메모리 (TypeORM) |
| Testcontainers (MySQL) | Testcontainers (@testcontainers/mysql) |
| JaCoCo | Jest --coverage (istanbul) |

### 6. Docker 이미지 전략

```dockerfile
# 멀티스테이지 빌드 (chat-server, api-server 동일 패턴)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
EXPOSE 8080
CMD ["node", "dist/main.js"]
```

**JVM → Node.js 리소스 변경:**

| 항목 | Spring Boot (현재) | NestJS (전환 후) |
|------|-------------------|-----------------|
| 베이스 이미지 | eclipse-temurin:17-jre | node:20-alpine |
| 이미지 크기 | ~300-500MB | ~100-200MB |
| 메모리 (idle) | 200-400MB | 30-80MB |
| JAVA_OPTS | `-Xms512m -Xmx2g` | 불필요 (NODE_OPTIONS로 대체 가능) |

---

## Risks / Trade-offs

### [Risk] STOMP 서버 라이브러리 성숙도
`stomp-broker-js`는 Spring의 SimpleBroker 대비 성숙도가 낮다.
→ **Mitigation:** Scale 모드에서는 RabbitMQ 외부 브로커를 사용하므로 영향 제한적. SimpleBroker 대체 시 기능 범위가 제한적(SUBSCRIBE/SEND/MESSAGE)이라 구현 난이도 낮음. 필요시 경량 STOMP 프레임 파서를 직접 구현할 수 있음.

### [Risk] TypeORM과 JPA의 기능 차이
JPA의 `@Version` 낙관적 락, Cascade, FetchType.LAZY 등이 TypeORM에서 다르게 동작할 수 있다.
→ **Mitigation:** ChatRoom의 `@Version` 낙관적 락은 TypeORM의 `@VersionColumn`으로 대응. Lazy Loading은 TypeORM에서 실험적이므로, 명시적 관계 로딩(relations 옵션)으로 대체.

### [Risk] 기존 테스트 재작성 비용
14개 Java 테스트 클래스를 Jest로 전환해야 한다.
→ **Mitigation:** SDD 08-test-specs.md의 테스트 명세가 기술 독립적이므로, 명세 기반으로 Jest 테스트를 새로 작성. Playwright E2E 테스트는 서버 언어와 무관하므로 즉시 검증 가능.

### [Risk] @Async MongoDB 비동기 쓰기 패턴 전환
Spring의 `@Async`로 처리하던 MongoDB 비동기 쓰기를 Node.js에서 어떻게 처리할지.
→ **Mitigation:** Node.js는 기본적으로 비동기이므로 `async/await` + `Promise`로 자연스럽게 처리. fire-and-forget 패턴은 `Promise`를 await하지 않으면 동일한 효과.

### [Trade-off] 두 서버 코드베이스 유지 비용
Java(-spring)와 NestJS 서버를 모두 보존하면 저장소 크기가 증가한다.
→ A/B 성능 비교와 롤백 안전성을 위해 감수. Phase 4 완료 후 Java 서버는 archive 브랜치로 분리 가능.

---

## Migration Plan

### SDD First 접근 (문서 → 구현)

**Phase A: 문서 업데이트 (Step 1)**
1. 기존 서버 폴더 리네이밍: `chat-server` → `chat-server-spring`, `api-server` → `api-server-spring`
2. SDD 문서 7개 파일 업데이트 (01, 04, 05, 06, 07, 08, 09)
3. 프로젝트 루트 문서 업데이트 (CLAUDE.md, README.md, database-setup.md)
4. .github 문서/CI 업데이트 (copilot-instructions.md, ci-server.yml, ci-api-server.yml)
5. client/.claude/rules 업데이트 (anti_pattern.md, skills.md)

**Phase B: api-server 구현 (Step 2)**
1. NestJS 프로젝트 생성 + 기본 설정
2. MongoDB 연동 (Mongoose)
3. MessageHistoryController + MessageQueryService 구현
4. cursor-based 페이지네이션 구현
5. Jest 단위 테스트 작성
6. Dockerfile 작성

**Phase C: chat-server 구현 (Step 3)**
1. NestJS 프로젝트 생성 + 기본 설정
2. TypeORM(MySQL) + Mongoose(MongoDB) + Redis 연동
3. Domain 계층 구현 (Entity, Repository Interface, DomainService)
4. Infrastructure 계층 구현 (TypeORM Repository, Mongoose Repository, Redis Service)
5. Application 계층 구현 (ApplicationService, DTO)
6. Presentation 계층 — REST Controller 구현
7. Presentation 계층 — STOMP WebSocket Gateway 구현
8. GlobalExceptionFilter 구현
9. Jest 단위 테스트 작성
10. Dockerfile 작성

**Phase D: 통합 및 검증 (Step 4)**
1. docker-compose.yml NestJS 서버로 전환
2. Playwright E2E 테스트 통과 확인
3. k6 부하테스트 실행 (Java vs Node.js 동일 시나리오)
4. 성능 비교 리포트 작성

### Rollback 전략
기존 Java 서버가 `-spring` 접미사로 보존되므로, docker-compose.yml의 빌드 컨텍스트를 `chat-server-spring`, `api-server-spring`으로 변경하면 즉시 롤백 가능.

---

## Open Questions

1. **패키지 매니저**: npm vs pnpm — monorepo 구조를 고려하면 pnpm이 유리하지만, 단순성을 위해 npm으로 시작할 수 있다.
2. **Node.js 버전**: 20 LTS vs 22 — 20 LTS가 안정적이지만, 22의 내장 테스트 러너 등 새 기능 활용 여부.
3. **STOMP 라이브러리 최종 선택**: `stomp-broker-js` vs 직접 구현 — 실제 클라이언트 연결 테스트 후 결정.
