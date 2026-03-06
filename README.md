#  AI-Based Real-time Chatting Service
- AI 기반 개발 방법론을 적용하여 설계된, 고가용성 및 확장성을 지향하는 실무형 채팅 웹 서비스입니다.

##  아키텍처 원칙 (Architecture Principles)
본 프로젝트는 특정 기술 스택에 종속되지 않는 유연한 구조를 지향합니다.

- Domain-Driven Design (DDD): 비즈니스 도메인을 중심으로 설계를 진행하여 핵심 로직의 응집도를 높였습니다.

- Infrastructure Independence: 추상화 레이어를 통해 비즈니스 로직과 세부 기술 구현을 분리하였습니다.
    - Database Agnostic: Repository 인터페이스 기반 설계를 통해 RDB(MySQL)뿐만 아니라 NoSQL(MongoDB 등)로의 전환이 용이합니다.
    - Messaging Decoupling: 현재는 STOMP 기반이지만, 향후 대용량 처리를 위한 Kafka 또는 RabbitMQ 도입 시 도메인 로직 수정 없이 인프라 교체가 가능한 구조입니다.

- Layered Architecture: Presentation, Application, Domain, Infrastructure 계층 간의 의존성 규칙을 엄격히 준수하여 유지보수성을 극대화했습니다.

## 🚀 빠른 시작 (Quick Start)

### 필수 설치사항
- **Docker** 또는 **Podman** (전체 서비스 컨테이너 실행)
- **Node.js 18+** (E2E 테스트 실행 시)

> **Podman 사용자 주의:** cgroup 권한 문제로 BuildKit이 실패할 수 있습니다.
> 프로젝트 루트의 `.env` 파일과 `~/.bash_profile`에 `DOCKER_BUILDKIT=0`이 설정되어 있으므로
> 새 터미널을 열면 자동으로 적용됩니다.

### 1단계: 전체 서비스 실행

```bash
# 최초 실행 또는 코드 변경 후 (이미지 재빌드 포함)
docker compose up -d --build

# 이미지 변경 없이 재시작
docker compose up -d
```

MySQL 초기화(스키마 적용)는 컨테이너 최초 기동 시 자동으로 처리됩니다.

### 접속 정보

| 서비스 | URL | 설명 |
|--------|-----|------|
| 클라이언트 1 | http://localhost:3000 | 첫 번째 사용자 |
| 클라이언트 2 | http://localhost:3001 | 두 번째 사용자 (테스트용) |
| 서버 API | http://localhost:8080 | 백엔드 API |
| MySQL | localhost:3307 | 데이터베이스 |

> **💡 팁**: 두 포트에서 각각 다른 사용자로 접속하면 실시간 채팅을 테스트할 수 있습니다.

### 로그 확인

```bash
# 전체 서비스 로그 (실시간)
docker compose logs -f

# 특정 서비스 로그만
docker compose logs -f server
docker compose logs -f client-3000
docker compose logs -f client-3001
```

### 서비스 중지 / 종료

```bash
# 컨테이너 중지 (DB 데이터 유지)
docker compose stop

# 컨테이너 삭제 (DB 데이터 유지)
docker compose down

# 컨테이너 + DB 데이터까지 완전 초기화
docker compose down -v
```

##  기술 스택
- Frontend: React.js, Tailwind CSS, SockJS, StompJS
- Backend: Node.js 20, NestJS 10.x, TypeORM, Mongoose, Jest
- Database: MySQL + MongoDB + Redis (Infrastructure Layer에서 교체 가능)
- Messaging: STOMP over WebSocket (인메모리 브로커 / RabbitMQ scale 모드)
- AI Tool: Claude Code, GitHub Copilot (Code Generation & Refactoring)

## 주요 기능
- 채팅 사이트 접속 시 닉네임 입력
- 실시간 메시지 송/수신
- 복수 채팅방 활용 가능
- 복수 인원이 채팅 가능
- 스티커/이미지 전송 가능
- 채팅방 나가기
- 채팅 메시지 검색
- 메시지 읽음 처리

## 테스트 방법

### Docker 기반 전체 테스트 (권장)

```bash
# 단위 테스트만 (백엔드 + 프론트엔드)
./docker-run-tests.sh --unit

# 전체 테스트 (단위 + E2E Playwright)
./docker-run-tests.sh
```

내부적으로 다음 순서로 실행됩니다.
1. MySQL 컨테이너 준비
2. 백엔드 단위 테스트 (NestJS Jest, Docker 내부)
3. 프론트엔드 단위 테스트 (Vitest, Docker 내부)
4. E2E 테스트 (Playwright, 호스트 Node.js 사용)

### 개별 테스트 실행

#### 프론트엔드 단위/컴포넌트 테스트 (Vitest + RTL)

```bash
# Docker로 실행
docker compose --profile test run --rm client-test

# 로컬에서 직접 실행
cd client
npm install
npm run test
```

개발 중 감시 모드:

```bash
cd client
npm run test:watch
```

#### 백엔드 단위 테스트 (Jest + @nestjs/testing)

```bash
# Docker로 실행
docker compose --profile test run --rm server-test

# 로컬에서 직접 실행
cd chat-server
npm test
```

#### 백엔드 테스트 커버리지 (Jest)

```bash
cd chat-server
npm test -- --coverage
```

리포트 위치:

- `chat-server/coverage/lcov-report/index.html`

#### E2E 테스트 (Playwright)

E2E 테스트는 전체 서비스가 실행 중이어야 합니다.

```bash
# 1. 서비스 먼저 실행
docker compose up -d

# 2. E2E 테스트 실행
cd client
npm install
npx playwright install
npm run test:e2e
```
