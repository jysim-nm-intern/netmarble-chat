## ADDED Requirements

### Requirement: SDD 문서 NestJS 기준 업데이트
Phase 4 마이그레이션에 따라 SDD 문서 7개 파일을 NestJS/TypeScript 기준으로 업데이트해야 한다(SHALL). SDD First 접근에 따라 코드 구현 전에 문서를 먼저 수정한다.

**대상 문서:**
- `docs/sdd/01-project-overview.md` — 기술 스택 변경
- `docs/sdd/04-data-model.md` — ORM 변경 (JPA → TypeORM/Mongoose)
- `docs/sdd/05-interface.md` — 서버 경로 확인 및 수정
- `docs/sdd/06-architecture.md` — 계층 구조, 패키지 트리 전면 재작성
- `docs/sdd/07-non-functional.md` — 런타임 변경에 따른 성능/보안 항목
- `docs/sdd/08-test-specs.md` — 테스트 프레임워크 변경
- `docs/sdd/09-ai-guide.md` — AI 코드 생성 가이드 NestJS 기준 재작성

#### Scenario: 기술 스택 항목 정확성
- **WHEN** 01-project-overview.md의 기술 스택 테이블을 확인할 때
- **THEN** 백엔드가 "NestJS (TypeScript)", ORM이 "TypeORM + Mongoose", 테스트가 "Jest"로 기재되어야 한다

#### Scenario: 아키텍처 패키지 트리 정확성
- **WHEN** 06-architecture.md의 패키지 구조를 확인할 때
- **THEN** NestJS의 `src/presentation/`, `src/application/`, `src/domain/`, `src/infrastructure/` 구조가 반영되어야 한다

---

### Requirement: 프로젝트 루트 문서 업데이트
CLAUDE.md, README.md, database-setup.md를 NestJS 기준으로 업데이트해야 한다(SHALL).

**변경 사항:**
- `CLAUDE.md` — 빌드/테스트 명령어(npm), 핵심 스택, 규칙
- `README.md` — 프로젝트 소개, 실행 방법, 기술 스택
- `database-setup.md` — TypeORM 마이그레이션 방식

#### Scenario: CLAUDE.md 빌드 명령어 정확성
- **WHEN** CLAUDE.md의 테스트 실행 섹션을 확인할 때
- **THEN** `./gradlew test` 대신 `npm test` 또는 `npm run test:e2e` 명령어가 기재되어야 한다

#### Scenario: README.md 실행 방법 정확성
- **WHEN** README.md의 실행 방법을 확인할 때
- **THEN** `npm install`, `npm run start:dev` 등 NestJS 기동 명령어가 기재되어야 한다

---

### Requirement: .github 문서 및 CI 워크플로우 업데이트
.github 디렉토리의 AI 가이드와 CI 파이프라인을 NestJS 기준으로 업데이트해야 한다(SHALL).

**대상:**
- `.github/copilot-instructions.md` — 기술 스택, DDD 계층, 테스트 명령어
- `.github/workflows/ci-server.yml` — gradlew → npm 빌드
- `.github/workflows/ci-api-server.yml` — gradlew → npm 빌드

#### Scenario: CI 서버 빌드 정확성
- **WHEN** ci-server.yml 워크플로우가 실행될 때
- **THEN** `npm ci && npm run build && npm test` 순서로 빌드/테스트가 수행되어야 한다

#### Scenario: CI Node.js 환경 설정
- **WHEN** CI 워크플로우가 실행될 때
- **THEN** `actions/setup-node`로 Node.js 20.x 환경이 설정되어야 한다

---

### Requirement: 클라이언트 Claude 규칙 업데이트
client/.claude/rules/ 내 Spring 관련 언급을 NestJS 기준으로 수정해야 한다(SHALL).

**대상:**
- `anti_pattern.md` — Spring Security 언급 → NestJS Guard/Passport
- `skills.md` — Spring Boot 내장 브로커 → NestJS STOMP 브로커

#### Scenario: anti_pattern.md 정확성
- **WHEN** anti_pattern.md를 확인할 때
- **THEN** Spring Security 관련 언급이 NestJS Guard/Passport로 대체되어 있어야 한다
