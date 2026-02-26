# 커밋 컨벤션

## 형식

```
type: 한국어 제목

- 변경 내용 요약 (bullet)

Refs: SPEC-XXX-000
Closes #N
```

---

## Type

| Type | 설명 |
|------|------|
| `feat` | 새 기능 구현 |
| `fix` | 버그 수정 |
| `test` | 테스트 추가·수정 |
| `docs` | 문서 변경 |
| `refactor` | 기능 변경 없는 코드 개선 |
| `chore` | 빌드, 설정, 의존성 변경 |
| `style` | 포맷, 세미콜론 등 로직 무관 변경 |

## 예시

```
feat: STOMP 실시간 메시지 송수신 구현

- MessageController /app/chat.message 핸들러 추가
- MessageApplicationService 저장 및 브로드캐스트 구현
- /topic/room/{roomId} 구독자 전체 브로드캐스트 처리

Refs: SPEC-MSG-001
Closes #4
```

```
feat: 채팅방 입장 시 메시지 이력 렌더링

- 입장 API 응답의 recentMessages를 채팅창에 초기 렌더링
- 입장 시점 이후 메시지만 표시하도록 필터링 처리

Refs: SPEC-ROOM-003
Closes #3
```

```
test: UserApplicationService 단위 테스트 추가

- 닉네임 중복 로그인 시 기존 사용자 반환 검증
- 프로필 이미지 없을 때 기본 색상 적용 검증

Refs: SPEC-USR-001
Closes #7
```

---

## 브랜치 네이밍

```
feature/phase-1/{기능명}   # 기능 구현
fix/phase-1/{버그명}       # 버그 수정
test/phase-1/{테스트명}    # 테스트 작성
docs/phase-1/{문서명}      # 문서 작업
```

예시:
```
feature/phase-1/stomp-message
feature/phase-1/chatroom-join
fix/phase-1/unread-count
test/phase-1/user-service
```

---

## PR 제목

```
[Phase 1] 한국어 제목 (#이슈번호)
```

예시:
```
[Phase 1] STOMP 실시간 메시지 송수신 구현 (#4)
[Phase 1] 채팅방 입장/퇴장 처리 (#3)
```
