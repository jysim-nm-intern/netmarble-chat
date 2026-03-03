# 보안 검토 보고서 — `feature/security-session-auth`

**검토 일자:** 2026-03-03
**검토 범위:** main 대비 변경된 파일 전체 (서버 인터셉터/컨트롤러, 클라이언트 API 레이어)

---

## 검토 결과 요약

**발견된 HIGH/MEDIUM 취약점: 없음**

모든 후보 항목에 대해 다단계 검증을 수행한 결과, 신뢰도 80% 이상의 실제 보안 취약점은 식별되지 않았습니다.

---

## 후보 항목 및 기각 사유

| # | 파일 | 분류 | 초기 신뢰도 | 검증 결과 | 기각 사유 |
|---|------|------|------------|----------|----------|
| 1 | `ChatController.java:81,116` | NPE / ClassCast | 9/10 | FALSE_POSITIVE (2/10) | 예외가 GlobalExceptionHandler에서 안전하게 처리됨. 인증 우회 없음. DOS 하드 제외 규칙 #1 적용 |
| 2 | `ChatRoomController.java:96` | 세션 속성 타입 캐스트 | 8/10 | FALSE_POSITIVE (2/10) | `userId`는 서버 코드에서 항상 `Long`으로 저장됨. 클라이언트가 세션 속성 타입을 조작할 수단 없음 |
| 3 | `UserController.java` | 세션 쿠키 HttpOnly 미설정 | 7/10 | 제외 | 강화 조치 누락에 해당 (하드 제외 규칙 #7). XSS 전제 조건 필요 |
| 4 | 전 컨트롤러 | CSRF 토큰 검증 없음 | 7/10 | 제외 | 프레임워크 수준 강화 조치 누락 (하드 제외 규칙 #7) |
| 5 | `WebConfig.java` | CORS allowCredentials | 6/10 | 제외 | 신뢰도 기준(8) 미달. 현재 localhost 하드코딩으로 실제 위협 없음 |

---

## 세부 검토 사항

### 세션 인증 인터셉터 (`infrastructure/interceptor/`)
- `StompAuthChannelInterceptor` 및 HTTP 인터셉터의 세션 검증 로직 정상 동작 확인
- `StompAuthChannelInterceptor`는 `userId instanceof Long` 타입 안전 체크 적용

### 컨트롤러 인증 처리
- `requireUserId(session)` 헬퍼가 미인증 요청에 대해 `UnauthorizedException` 정상 발생
- `GlobalExceptionHandler`가 예외를 일관된 형식으로 처리, 스택 트레이스 노출 없음

### 클라이언트 변경 사항 (`axiosConfig.js`, `WebSocketService.js` 등)
- `withCredentials: true` 설정으로 세션 쿠키 전달 — 서버 CORS 정책과 일치
- React 컴포넌트에서 `dangerouslySetInnerHTML` 미사용, XSS 위험 없음

---

## 결론

이번 브랜치의 변경 사항에서 **실제 악용 가능한 보안 취약점은 발견되지 않았습니다.** 커밋을 진행해도 됩니다.
