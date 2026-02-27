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

### Server 단위 테스트 (`./gradlew test`)
- [ ] 통과
- 실행 결과:
```
BUILD SUCCESS / FAILED
Tests run: N, Failures: 0, Errors: 0
```

### Server 통합 테스트 (`./gradlew integrationTest`, MySQL)
- [ ] 통과 / 해당 없음
- 실행 결과:
```
BUILD SUCCESS / FAILED
Tests run: N, Failures: 0, Errors: 0
```

### Client 단위 테스트 (`npm test`)
- [ ] 통과 / 해당 없음
- 실행 결과:
```
N passed, 0 failed
```

### E2E 테스트 (Playwright)
- [ ] 통과 / 해당 없음
- 실행 결과:
```
N passed, 0 failed
```

---

## 🤖 AI 코드 리뷰 체크리스트

> Copilot, Claude, CodeRabbit 등 AI 리뷰어가 코드 리뷰 후 아래 항목을 체크합니다.

- [ ] **DDD 계층 준수** — Controller → Service → Domain 방향 의존성 유지, Repository 직접 호출 없음
- [ ] **REST/STOMP 역할 분리** — 실시간 메시지는 STOMP(`/app`), 조회/등록은 REST
- [ ] **Entity 직접 반환 금지** — API 응답은 반드시 DTO 사용
- [ ] **인수 조건(AC) 충족** — 관련 SPEC의 모든 AC 항목 구현 여부 확인
- [ ] **예외 처리** — GlobalExceptionHandler를 통한 일관된 오류 응답
- [ ] **테스트 커버리지** — 변경된 로직에 대한 단위 테스트 존재
