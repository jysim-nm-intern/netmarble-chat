## ADDED Requirements

### Requirement: NestJS Docker 멀티스테이지 빌드
chat-server와 api-server의 Dockerfile은 Node.js 20 Alpine 기반 멀티스테이지 빌드로 구성해야 한다(SHALL).

**스테이지:**
1. `builder` — npm ci, npm run build (TypeScript 컴파일)
2. `runner` — dist/, node_modules, package.json만 복사하여 경량 실행 이미지 생성

#### Scenario: chat-server Docker 이미지 빌드
- **WHEN** `docker build -t chat-server ./chat-server`를 실행할 때
- **THEN** 멀티스테이지 빌드가 성공하고, 최종 이미지에 TypeScript 소스 없이 컴파일된 JavaScript만 포함된다

#### Scenario: 이미지 크기 최적화
- **WHEN** NestJS Docker 이미지가 빌드될 때
- **THEN** 최종 이미지 크기가 200MB 이하여야 한다 (JDK 기반 300-500MB 대비 감소)

---

### Requirement: docker-compose.yml NestJS 서버 전환
docker-compose.yml의 server, api-server 서비스가 NestJS 빌드 컨텍스트를 사용해야 한다(SHALL).

**변경 사항:**
- `server` 서비스: build context `./chat-server` (NestJS)
- `api-server` 서비스: build context `./api-server` (NestJS)
- 환경변수: `SPRING_PROFILES_ACTIVE` → `NODE_ENV` 등 Node.js 환경변수로 전환
- 포트: chat-server 8080, api-server 8081 유지

#### Scenario: docker compose up 정상 기동
- **WHEN** `docker compose up`을 실행할 때
- **THEN** NestJS chat-server(8080), api-server(8081), MySQL, MongoDB, Redis가 정상 기동된다

#### Scenario: 환경변수 주입
- **WHEN** docker-compose.yml에서 MySQL 연결 정보를 환경변수로 전달할 때
- **THEN** NestJS 서버가 해당 환경변수를 읽어 TypeORM DataSource를 구성한다

---

### Requirement: scale 프로파일 NestJS 전환
docker-compose.yml의 `scale` 프로파일 서비스도 NestJS 빌드로 전환해야 한다(SHALL).

**변경 대상:**
- `chat-server-1`, `chat-server-2` — NestJS 빌드
- `JAVA_OPTS` → `NODE_OPTIONS` (메모리 설정)
- 헬스체크: wget actuator → HTTP /health 엔드포인트

#### Scenario: scale 프로파일 2인스턴스 기동
- **WHEN** `docker compose --profile scale up`을 실행할 때
- **THEN** NestJS 기반 chat-server-1, chat-server-2가 각각 기동되고, RabbitMQ에 연결된다

#### Scenario: 헬스체크 정상 동작
- **WHEN** NestJS chat-server가 기동 완료될 때
- **THEN** `GET /health` 엔드포인트가 200 OK를 반환하고, Docker 헬스체크가 통과한다

---

### Requirement: GitHub Actions CI 파이프라인 전환
ci-server.yml과 ci-api-server.yml을 NestJS 빌드/테스트 파이프라인으로 전환해야 한다(SHALL).

#### Scenario: CI 빌드 성공
- **WHEN** PR이 생성되어 ci-server.yml 워크플로우가 트리거될 때
- **THEN** `actions/setup-node@v4`로 Node.js 20.x 환경을 설정하고, `npm ci && npm run build && npm test` 순서로 실행된다

#### Scenario: 테스트 결과 리포트
- **WHEN** Jest 테스트가 실행될 때
- **THEN** 테스트 결과와 커버리지 리포트가 CI 아티팩트로 업로드된다
