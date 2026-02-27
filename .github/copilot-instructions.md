# GitHub Copilot 코드 리뷰 지침

## 언어

모든 코드 리뷰 코멘트는 **한국어**로 작성합니다.
파일명, 변수명, 코드 인용은 원문 그대로 유지하고, 설명과 피드백은 한국어로 작성합니다.

---

## 보안 취약점 경고 (최우선)

보안 취약점이 발견된 경우 **`🚨 [보안 경고]` 접두어**를 붙여 강력하게 경고합니다.
심각도에 관계없이 보안 문제는 모두 명시적으로 지적하고, 수정 방법을 구체적으로 제안합니다.

반드시 검토할 보안 항목:

- **SQL Injection** — JPA/JPQL 사용 시 Native Query에서 파라미터 바인딩 누락 여부
- **XSS (Cross-Site Scripting)** — 사용자 입력이 HTML/JS에 그대로 삽입되는 경우
- **CSRF** — 상태 변경 API에 CSRF 토큰 또는 SameSite 쿠키 정책 누락 여부
- **인증·인가 누락** — 보호되어야 할 API 엔드포인트에 인증 검사가 없는 경우
- **민감 정보 노출** — 비밀번호, API 키, 토큰이 로그·응답 바디·소스 코드에 포함된 경우
- **경로 탐색 (Path Traversal)** — 파일 업로드·다운로드 경로에 사용자 입력이 반영되는 경우
- **입력 유효성 검증 누락** — 서버 측 검증 없이 클라이언트 값을 그대로 신뢰하는 경우
- **열린 리다이렉트 (Open Redirect)** — 외부 URL로 리다이렉트 시 검증 없는 경우
- **과도한 CORS 허용** — `allowedOrigins("*")` + `allowCredentials(true)` 동시 사용
- **WebSocket 인가** — STOMP 연결 및 메시지 발행 시 사용자 신원 검증 누락

---

## 프로젝트 아키텍처 컨텍스트

### 기술 스택

| 영역 | 스택 |
|------|------|
| Backend | Java 17, Spring Boot 3.x, JPA (Hibernate 6), MySQL, STOMP (SimpleBroker) |
| Frontend | React (Vite), Zustand, TailwindCSS, @stomp/stompjs, SockJS |
| Test | JUnit 5 + Mockito (Server), Vitest + Testing Library (Client), Playwright (E2E) |

### Hybrid Communication Protocol (핵심 원칙)

| 통신 방식 | 사용 용도 |
|-----------|-----------|
| **REST API** | 사용자 접속, 방 생성/조회, 이미지 업로드, 메시지 이력 조회 |
| **WebSocket (STOMP)** | 실시간 메시지 송수신, 읽음 처리 알림, 입장/퇴장 이벤트 전파 |

> 실시간 메시지 전송을 REST로 구현한 경우 반드시 지적합니다.
> STOMP 발행은 `/app` 경로, 구독은 `/topic` 또는 `/queue` 경로를 사용합니다.

### DDD 계층 구조 (Domain-Driven Decoupling)

```
Presentation (Controller)
    ↓  DTO만 사용
Application (Service)
    ↓  Domain Interface 호출
Domain (Model + Repository Interface)
    ↑  구현체 주입
Infrastructure (JPA Repository 구현, WebSocket Config 등)
```

**계층 규칙:**
- Controller는 Repository를 직접 호출하지 않습니다.
- Domain 모델(Entity)을 API 응답으로 직접 반환하지 않습니다. 반드시 DTO를 사용합니다.
- Domain 로직은 외부 기술(JPA, STOMP, Kafka 등)에 의존하지 않습니다.

---

## 코드 리뷰 체크리스트

PR 리뷰 시 아래 항목을 순서대로 검토하고, 문제가 있는 경우 코멘트를 남깁니다.

### 1. DDD 계층 준수

- [ ] Controller → Service → Domain 방향의 의존성이 지켜지는가
- [ ] Controller에서 Repository를 직접 호출하는 코드가 없는가
- [ ] Entity가 `@RestController`의 응답 바디로 직접 반환되지 않는가

### 2. REST / STOMP 역할 분리

- [ ] 실시간 메시지 전송이 STOMP(`/app` 경로)를 통해 처리되는가
- [ ] 메시지 이력 조회, 방 생성/목록 조회 등은 REST API로 처리되는가

### 3. 입력 유효성 검증

- [ ] 서버 측에서 사용자 입력(닉네임, 채팅방 이름, 메시지 내용 등)을 검증하는가
- [ ] `@Valid` / `@Validated` 어노테이션 또는 도메인 생성자 내 검증 로직이 존재하는가

### 4. 예외 처리

- [ ] 비즈니스 예외가 `GlobalExceptionHandler`(또는 `@ControllerAdvice`)를 통해 일관된 형식으로 응답되는가
- [ ] 스택 트레이스나 내부 구현 정보가 클라이언트 응답에 노출되지 않는가

### 5. 테스트

- [ ] 변경된 비즈니스 로직에 대한 단위 테스트가 존재하는가
- [ ] 테스트가 `LocalDateTime.now()` 등 환경 의존적 값에 의존하지 않는가 (결정적 테스트)
- [ ] 통합 테스트는 `@Tag("integration")`으로 분리되어 있는가

### 6. 코드 품질

- [ ] 하드코딩된 비밀값(비밀번호, 토큰, URL 등)이 없는가
- [ ] `TODO` / `FIXME` 주석이 불필요하게 남아있지 않은가
- [ ] 사용되지 않는 import, 변수, 메서드가 없는가

---

## 리뷰 완료 후 체크리스트 반영 방법

### 역할 분담

| 역할 | 담당 |
|------|------|
| **PR 본문 체크박스 체크** | PR 작성자(Claude Code가 로컬 검토 후 `gh pr edit`으로 반영) |
| **외부 AI 리뷰어(Copilot 등) 역할** | PR 리뷰 코멘트로 결과 요약 (체크박스 직접 수정 불가) |

> GitHub는 PR 본문의 체크박스를 PR 작성자(또는 관리자)만 수정할 수 있습니다.
> Copilot은 리뷰 코멘트를 통해 결과를 알리고, Claude Code가 `gh pr edit`으로 체크박스를 업데이트합니다.

### Copilot 리뷰 코멘트 형식

코드 리뷰가 끝나면 **PR 리뷰 코멘트 마지막에 결과 요약표를 반드시 첨부**합니다.

```
## 🤖 AI 코드 리뷰 체크리스트 검토 결과

| 항목 | 결과 | 비고 |
|------|------|------|
| DDD 계층 준수 | ✅ 통과 / ❌ 미준수 | (필요시 설명) |
| REST/STOMP 역할 분리 | ✅ 통과 / ❌ 미준수 | |
| Entity 직접 반환 금지 | ✅ 통과 / ❌ 미준수 | |
| 인수 조건(AC) 충족 | ✅ 통과 / ❌ 미준수 | |
| 예외 처리 | ✅ 통과 / ❌ 미준수 | |
| 테스트 커버리지 | ✅ 통과 / ❌ 미준수 | |
```

모든 항목이 통과한 경우에만 전체 승인(Approve)을 표시합니다.
하나라도 미준수 항목이 있으면 해당 항목에 대한 구체적인 수정 방법을 코멘트에 포함합니다.

---

## 리뷰 코멘트 형식

```
[심각도] 설명

예시 또는 수정 방향 (해당하는 경우)
```

**심각도 분류:**

| 접두어 | 의미 |
|--------|------|
| `🚨 [보안 경고]` | 반드시 수정해야 하는 보안 취약점 |
| `❌ [필수]` | 병합 전 반드시 수정해야 하는 오류 |
| `⚠️ [권고]` | 수정을 강력히 권장하는 문제 |
| `💡 [제안]` | 선택적 개선 사항 |
| `✅ [확인]` | 올바르게 구현된 부분에 대한 긍정적 피드백 |
