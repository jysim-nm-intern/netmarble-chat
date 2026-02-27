## 🔗 관련 이슈 / SPEC

- Closes #
- 구현 SPEC: `SPEC-XXX-000`, `SPEC-XXX-001`

---

## 📝 변경 사항 요약

### 추가
-

### 수정
-

### 삭제
-

---

## ✅ 테스트 실행 결과

> **PR 생성 전 로컬에서 모두 실행 후 결과를 기록합니다.**

### Server 단위 테스트 (`./gradlew test`)
- [ ] 통과
- 실행 결과: `Tests run: N, Failures: 0, Errors: 0`

### Server 통합 테스트 (`./gradlew integrationTest`, MySQL)
- [ ] 통과 / 해당 없음
- 실행 결과: `Tests run: N, Failures: 0, Errors: 0`

### Client 단위 테스트 (`npm test`)
- [ ] 통과 / 해당 없음
- 실행 결과: `N passed, 0 failed`

### E2E 테스트 (`cd client && npx playwright test`)
- [ ] 통과 / 일부 실패 / 해당 없음
- 실행 결과: `N passed, N failed`
- 실패 항목 (있는 경우):

---

## 🤖 AI 코드 리뷰 체크리스트

> **PR 생성 전 Claude Code가 로컬에서 코드를 검토하고 체크합니다.**
> Copilot, CodeRabbit 등 외부 AI 리뷰어는 리뷰 완료 후 코멘트로 결과를 요약합니다.

- [ ] **보안 검토** — `/security-review` 실행, SQL Injection · XSS · 인증/인가 누락 · 민감 정보 노출 취약점 없음
- [ ] **DDD 계층 준수** — Controller → Service → Domain 방향 의존성 유지, Repository 직접 호출 없음
- [ ] **REST/STOMP 역할 분리** — 실시간 메시지는 STOMP(`/app`), 조회/등록은 REST
- [ ] **Entity 직접 반환 금지** — API 응답은 반드시 DTO 사용
- [ ] **인수 조건(AC) 충족** — 관련 SPEC의 모든 AC 항목 구현 여부 확인
- [ ] **예외 처리** — GlobalExceptionHandler를 통한 일관된 오류 응답
- [ ] **테스트 커버리지** — 변경된 로직에 대한 단위 테스트 존재
