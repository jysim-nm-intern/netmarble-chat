# 🚀 Real-Time Multi-Chat Project Guide

이 파일은 프로젝트의 통합 컨텍스트 가이드입니다. AI는 코드 생성 및 수정 시 아래 가이드라인을 최우선으로 준수해야 합니다.

## 1. Context Hierarchy (가이드라인 우선순위)

1. **SDD 명세 (최우선):** `docs/sdd-specification.md` 및 `docs/sdd/` 하위 문서
2. **Local 규칙:** `server/.claude/rules/`, `client/.claude/rules/`
3. **Index:** 본 파일 (`CLAUDE.md`)

---

## 2. 핵심 아키텍처 원칙 (Critical)

**"Hybrid Communication Protocol"**

- **REST API:** 유저 접속, 방 생성/조회, 이미지 업로드, 메시지 이력 조회, 검색에만 사용합니다.
- **WebSocket (STOMP):** 실시간 메시지 송수신, 읽음 처리 알림, 입장/퇴장 이벤트 전파에만 사용합니다.
- **주의:** 실시간 메시지 전송을 REST API로 구현하지 마세요. 반드시 STOMP 발행(`/app`) 경로를 거쳐야 합니다.

**"Domain-Driven Decoupling (DDD)"**

- 인프라 독립성 확보: 비즈니스 로직(Domain)은 외부 기술 스택(RDB, NoSQL, STOMP, Kafka 등)에 의존하지 않아야 합니다.
- Interface 기반 설계: 데이터 저장소나 메시징 브로커는 Interface를 통해 추상화하세요.
- **계층 간 격리:** Controller가 Repository를 직접 호출하지 않습니다. Entity를 API 응답으로 직접 반환하지 않습니다.

---

## 3. 개발 가이드라인

### 공통 규칙 (Global)

- **언어:** 모든 코드 주석, 시스템 메시지, 사용자 응답은 **한국어**로 작성합니다.
- **OS:** **Windows** 환경 기준.
- **커밋:** Conventional Commits 형식 준수. 상세 규칙은 [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) 참조.
  - 형식: `type: 한국어 제목` → body에 변경 내용 bullet + `Refs: SPEC-XXX-000` + `Closes #N`
  - 주요 type: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`
- **동작:** 코드 수정 전 기존 구조를 분석하고, 대규모 변경 시 사용자에게 계획을 먼저 공유합니다.
- **테스트 실행 (필수):** 기능 구현, 리팩토링, 코드 변경이 완료되면 변경된 부분과 관련된 단위 테스트(Unit Test) 및 E2E 테스트를 반드시 실행하고 결과를 확인합니다. 테스트가 실패하면 수정 후 재실행하여 모든 테스트가 통과할 때까지 작업을 완료로 간주하지 않습니다.

### Backend (Spring Boot)

- **규칙:** `server/.claude/rules/` 참조
- **핵심 스택:** Java 17, Spring Boot 3.x, JPA, MySQL, STOMP
- **특이사항:** `SimpleBroker` 사용, `/topic` 구독 · `/app` 발행 경로.

### Frontend (React)

- **규칙:** `client/.claude/rules/` 참조
- **핵심 스택:** Vite, Zustand, TailwindCSS, @stomp/stompjs
- **특이사항:** 전역 상태(Zustand)로 실시간 메시지 리스트와 유저 세션을 관리합니다.

---

## 4. SDD 문서 참조

새로운 기능 구현 시 반드시 아래 문서의 해당 SPEC을 먼저 확인하십시오.

| 문서 | 경로 | 용도 |
|------|------|------|
| **SDD 전체 목차** | [docs/sdd-specification.md](docs/sdd-specification.md) | 진입점 |
| **기능 명세** | [docs/sdd/03-functional-specs.md](docs/sdd/03-functional-specs.md) | SPEC별 입력/출력 계약, 인수 조건 |
| **인터페이스 명세** | [docs/sdd/05-interface.md](docs/sdd/05-interface.md) | REST API · WebSocket/STOMP 계약 |
| **데이터 모델** | [docs/sdd/04-data-model.md](docs/sdd/04-data-model.md) | DB 스키마, 비즈니스 규칙 |
| **아키텍처** | [docs/sdd/06-architecture.md](docs/sdd/06-architecture.md) | 계층 구조, 패키지 트리 |
| **테스트 명세** | [docs/sdd/08-test-specs.md](docs/sdd/08-test-specs.md) | SPEC-테스트 ID 매핑 |
| **AI 협업 가이드** | [docs/sdd/09-ai-guide.md](docs/sdd/09-ai-guide.md) | 프롬프트 템플릿, 검증 체크리스트 |

"항상 기본 가정보다 위 SDD 문서에 정의된 내용을 우선하여 코드를 생성하십시오."
