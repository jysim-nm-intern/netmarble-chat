# 08. 테스트 명세 (Test Specifications)

← [목차로 돌아가기](../sdd-specification.md) | 상세 실행 절차 → [08b. 테스트 시나리오](08b-test-scenarios.md)

---

## 테스트 계층

| 종류 | 도구 | 범위 | 실행 명령 |
|------|------|------|----------|
| **BE 도메인 단위** | Jest | Domain Model·Service 비즈니스 로직 | `cd chat-server && npm test` |
| **BE 애플리케이션 단위** | Jest + `@nestjs/testing` | Application Service 유즈케이스 | `cd chat-server && npm test` |
| **BE 컨트롤러** | Jest + `@nestjs/testing` | HTTP 요청/응답, 예외 처리 | `cd chat-server && npm test` |
| **BE 통합** | Jest + 실제 MySQL | Repository, DB 쿼리 검증 | `cd chat-server && npm run test:e2e` |
| **FE 단위/컴포넌트** | Vitest + React Testing Library | 컴포넌트 렌더링, 사용자 상호작용 | `cd client && npm run test` |
| **E2E** | Playwright | 핵심 사용자 시나리오 전체 흐름 | `cd client && npm run test:e2e` |

> **통합 테스트 전제 조건:** `*.e2e-spec.ts` 파일은 MySQL(`localhost:3306`)이 실행 중이어야 한다.
> 단위 테스트(`npm test`)는 외부 인프라 없이 항상 실행 가능하다.

---

## 커버리지 정책 (Jest)

> 핵심 비즈니스 로직을 구현하거나 수정할 때 아래 기준을 충족하는 단위 테스트를 함께 작성한다.
> 커버리지 기준은 [07. 비기능 명세 SPEC-NFR-005](07-non-functional.md#spec-nfr-005-테스트-커버리지-jest)를 따른다.

| 계층 | 목표 | 현재 (단위 테스트 기준) |
|-----|------|----------------------|
| `src/domain/service/` | 90% 이상 | ⬜ NestJS 마이그레이션 후 측정 |
| `src/domain/model/` | 80% 이상 | ⬜ NestJS 마이그레이션 후 측정 |
| `src/application/service/` | 70% 이상 | ⬜ NestJS 마이그레이션 후 측정 |
| `src/presentation/controller/` | 50% 이상 | ⬜ NestJS 마이그레이션 후 측정 |
| **전체** | **60% 이상** | ⬜ NestJS 마이그레이션 후 측정 |

```bash
# 커버리지 보고서 생성
cd server/chat-server && npm test -- --coverage

# 보고서 확인
server/chat-server/coverage/lcov-report/index.html
```

---

## SPEC → 테스트 ID 매핑

### 구현 완료 (✅ 테스트 존재)

#### 도메인 모델 (Domain Model)

| 테스트 ID | 관련 SPEC | 검증 내용 |
|-----------|-----------|-----------|
| BE-MODEL-USER-001~016 | SPEC-USR-001 | `User` 닉네임 유효성(길이·문자), 프로필 업데이트, 활성화/비활성화 |
| BE-MODEL-MSG-001~008 | SPEC-MSG-001~003 | `Message` 생성·삭제·타입별 유효성, 시스템 메시지 팩토리 |
| BE-MODEL-ROOM-001~018 | SPEC-ROOM-001~004 | `ChatRoom` 이름 유효성, 멤버 추가·재입장·퇴장, 활성 여부 |
| BE-MODEL-MEMBER-001~016 | SPEC-READ-001 | `ChatRoomMember` 입장·퇴장·재입장, 읽음 메시지 업데이트·확인 |

#### 도메인 서비스 (Domain Service)

| 테스트 ID | 관련 SPEC | 인수 조건 | 검증 내용 |
|-----------|-----------|-----------|-----------|
| BE-DOMAIN-001 | SPEC-USR-001 | AC-USR-001-5 | 닉네임으로 신규 사용자 생성 (UserDomainService) |
| BE-DOMAIN-002 | SPEC-USR-001 | AC-USR-001-5 | 닉네임 중복 시 도메인 서비스에서 예외 발생 |

#### 애플리케이션 서비스 (Application Service)

| 테스트 ID | 관련 SPEC | 인수 조건 | 검증 내용 |
|-----------|-----------|-----------|-----------|
| BE-USR-001 | SPEC-USR-001 | AC-USR-001-5 | 기존 닉네임 로그인 시 사용자 반환 및 프로필 갱신 |
| BE-USR-002 | SPEC-USR-001 | AC-USR-001-2 | 신규 닉네임 로그인 시 사용자 생성 후 반환 |
| BE-USR-003~007 | SPEC-USR-001 | - | ID/닉네임 조회, 활성 목록, 중복 확인, 활동 시간 갱신 |
| BE-ROOM-001 | SPEC-ROOM-002 | AC-ROOM-002-1 | 1자 방 이름으로 생성 시 예외 발생 (`ChatRoomTest`) |
| BE-ROOM-002 | SPEC-ROOM-002 | - | 정상 방 이름으로 채팅방 생성 성공 |
| BE-ROOM-003 | SPEC-ROOM-003 | AC-ROOM-003-1 | 채팅방 입장 시 SYSTEM 메시지 생성 및 WebSocket 브로드캐스트 |
| BE-ROOM-004 | SPEC-ROOM-004 | AC-ROOM-004-3 | 이미 활성 멤버 재입장 시 시스템 메시지 미생성 |
| BE-ROOM-005 | SPEC-ROOM-004 | AC-ROOM-004-1 | 퇴장 시 SYSTEM 메시지 브로드캐스트 |
| BE-ROOM-006~010 | SPEC-ROOM-001~004 | - | 채팅방 조회, 멤버 목록, 활성 상태 업데이트, 활동 갱신 |
| BE-READ-001 | SPEC-READ-001 | AC-READ-001-5 | 읽음 처리 후 unreadCount 감소 계산 |
| BE-READ-002~008 | SPEC-READ-001 | - | markAsRead, getUnreadCount(경계값), getAllUnreadCounts |
| BE-MSG-SVC-JOIN-001 | SPEC-ROOM-003 | AC-ROOM-003-9 | userId 있을 때 입장 시점 이후 메시지만 반환 |
| BE-MSG-SVC-JOIN-002 | SPEC-ROOM-003 | AC-ROOM-003-9 | userId null이면 전체 메시지 반환 |
| BE-MSG-SVC-JOIN-003 | SPEC-ROOM-003 | AC-ROOM-003-9 | 활성 멤버가 아니면 빈 목록 반환 |
| BE-MSG-SVC-JOIN-004 | SPEC-ROOM-003 | - | 존재하지 않는 채팅방 → 예외 발생 |
| BE-MSG-SVC-JOIN-005 | SPEC-ROOM-003 | AC-ROOM-003-9 | 입장 시점 이후 메시지 없음 → 빈 목록 반환 |
| BE-SVC-SEARCH-001 | SPEC-MSG-005 | AC-MSG-005-2 | keyword trim 후 repository 호출 검증 |
| BE-SVC-SEARCH-002 | SPEC-MSG-005 | AC-MSG-005-1 | null 키워드 시 예외 발생 |
| BE-SVC-SEARCH-003 | SPEC-MSG-005 | AC-MSG-005-1 | 255자 초과 키워드 시 예외 발생 |
| BE-SVC-SEARCH-004 | SPEC-MSG-005 | - | 존재하지 않는 채팅방 ID → 예외 발생 |
| BE-SVC-SEARCH-005 | SPEC-MSG-005 | AC-MSG-005-3 | 검색 결과 없음 → 빈 리스트 반환 |

#### 컨트롤러 / HTTP 계층

| 테스트 ID | 관련 SPEC | 인수 조건 | 검증 내용 |
|-----------|-----------|-----------|-----------|
| BE-API-HEALTH-001 | - | - | GET /api/health → 200 OK, status=OK |
| BE-API-SEARCH-001 | SPEC-MSG-005 | AC-MSG-005-2 | GET /api/chat-rooms/{id}/messages/search → 200 OK |
| BE-API-SEARCH-002 | SPEC-MSG-005 | AC-MSG-005-1 | 빈 키워드 요청 → 400 오류 |
| BE-API-SEARCH-003 | SPEC-MSG-005 | AC-MSG-005-3 | 검색 결과 없음 → 200 빈 배열 |
| BE-API-SEARCH-004 | SPEC-MSG-005 | AC-MSG-005-4 | 특수문자 키워드 → 200 결과 반환 |

#### 통합 테스트 (Integration — MySQL 필요)

| 테스트 ID | 관련 SPEC | 인수 조건 | 검증 내용 |
|-----------|-----------|-----------|-----------|
| BE-INT-USER-001 | SPEC-USR-001 | AC-USR-001-2 | 로컬 MySQL로 사용자 저장/닉네임 조회 |
| BE-INT-SEARCH-001 | SPEC-MSG-005 | AC-MSG-005-2 | 키워드 포함 메시지 반환 및 최신순 정렬 |
| BE-INT-SEARCH-002 | SPEC-MSG-005 | AC-MSG-005-4 | 대소문자 무시 검색 |
| BE-INT-SEARCH-003 | SPEC-MSG-005 | AC-MSG-005-4 | 특수문자 포함 검색 |
| BE-INT-SEARCH-004 | SPEC-MSG-005 | - | 삭제된 메시지 검색 결과 제외 |

#### 프론트엔드 / E2E

| 테스트 ID | 관련 SPEC | 인수 조건 | 검증 내용 |
|-----------|-----------|-----------|-----------|
| FE-LOGIN-001 | SPEC-USR-001 | AC-USR-001-1 | 1자 닉네임 입력 시 오류 메시지 표시, 서버 요청 미발생 |
| FE-LOGIN-002 | SPEC-USR-001 | AC-USR-001-2,3,4 | 정상 닉네임 로그인 성공, localStorage 저장, 화면 전환 |
| FE-ROOM-001 | SPEC-ROOM-002 | AC-ROOM-002-2,3 | 채팅방 생성 모달 동작 및 콜백 호출 |
| FE-ROOM-002 | SPEC-ROOM-001 | AC-ROOM-001-3 | 목록 로딩 실패 시 재시도 버튼 표시 |
| FE-WS-001 | SPEC-ROOM-001 | - | `WebSocketService.addConnectionListener` 리스너 등록 및 해제 |
| FE-WS-002 | SPEC-ROOM-001 | - | `WebSocketService.connect()` 성공 시 `isConnected=true` 및 리스너 통보 |
| FE-WS-003 | SPEC-ROOM-001 | - | 이미 연결된 상태에서 `connect()` 호출 시 즉시 resolve |
| FE-WS-004 | SPEC-ROOM-001 | - | STOMP/WebSocket 에러 시 reject 및 `isConnected=false` |
| FE-WS-005 | SPEC-ROOM-001 | - | `disconnect()` 시 모든 구독 해제, 리스너에 false 통보 |
| FE-WS-006 | SPEC-ROOM-001 | - | 미연결 상태에서 `subscribeToChatRoom()` → null 반환 |
| FE-WS-007 | SPEC-ROOM-001 | - | 연결 상태에서 `subscribeToChatRoom()` → 구독 객체 반환, 중복 구독 시 기존 해제 |
| FE-WS-008 | SPEC-ROOM-001 | - | `unsubscribeFromChatRoom()` 메시지+읽음 상태 구독 모두 해제 |
| FE-WS-009 | SPEC-MSG-001 | - | 미연결 상태 `sendMessage()` 예외 발생, 연결 상태에서 publish 성공 |
| FE-WS-010 | SPEC-ROOM-003 | - | `notifyUserJoined()` SYSTEM 메시지 publish |
| FE-ROOM-LIST-WS-001 | SPEC-ROOM-001 | AC-ROOM-001-9 | WebSocket 연결 시 참가중인 방에만 구독 (미참가 방 제외) |
| FE-ROOM-LIST-WS-002 | SPEC-ROOM-001 | AC-ROOM-001-9 | 타인 메시지 수신 시 마지막 메시지 내용 및 unreadCount 갱신 |
| FE-ROOM-LIST-WS-003 | SPEC-ROOM-001 | AC-ROOM-001-10 | 본인 메시지 수신 시 unreadCount 미증가 |
| FE-ROOM-LIST-WS-004 | SPEC-ROOM-001 | AC-ROOM-001-10 | 시스템 메시지 수신 시 unreadCount 미증가 |
| FE-ROOM-LIST-WS-005 | SPEC-ROOM-001 | AC-ROOM-001-12 | 이미지 메시지 수신 시 `[사진]`, 스티커 메시지 시 `[스티커]` 표시 |
| FE-ROOM-LIST-WS-006 | SPEC-ROOM-001 | - | `data:image` 시작 TEXT 메시지도 `[사진]`으로 표시 |
| FE-ROOM-LIST-WS-007 | SPEC-ROOM-001 | - | `onTotalUnreadChange`로 참가중인 방의 총 unreadCount 전달 |
| FE-ROOM-LIST-WS-008 | SPEC-ROOM-001 | - | 실시간 메시지 수신 후 총 unreadCount 값 갱신 |
| FE-ROOM-LIST-FILTER-001 | SPEC-ROOM-001 | - | `filter=unread` 시 읽지 않은 방만 표시 |
| FE-ROOM-WS-LIFECYCLE-001 | SPEC-ROOM-001 | - | `ChatRoom` 마운트 시 `webSocketService.connect()` 호출 |
| FE-ROOM-WS-LIFECYCLE-002 | SPEC-ROOM-001 | - | `ChatRoom` 언마운트 시 `webSocketService.disconnect()` 호출 |
| FE-ROOM-WS-LIFECYCLE-003 | SPEC-ROOM-001 | - | `connect()` 실패해도 에러 없이 렌더링 |
| FE-SEARCH-001~004 | SPEC-MSG-005 | AC-MSG-005-1,2,3,6 | 검색 결과 렌더링, 빈 결과 안내, 서버 오류 처리 |
| E2E-CHAT-001~004 | SPEC-ROOM, SPEC-READ | - | 로그인→채팅방→메시지 전송→읽음 처리 전체 흐름 |
| E2E-SEARCH-001~011 | SPEC-MSG-005 | - | 키워드·발신자·날짜 필터 검색, 하이라이트, 화살표 이동 |
| E2E-CHAT-001 | SPEC-ROOM-002, SPEC-MSG-001 | AC-ROOM-002-3, AC-MSG-001-1 | 로그인 → 채팅방 생성 → WebSocket 연결 → 메시지 전송 |
| E2E-CHAT-002 | SPEC-ROOM-003, SPEC-READ-001 | AC-ROOM-003-1, AC-READ-001-1 | 로그인 → 기존 채팅방 입장 → 시스템 메시지 → 메시지 전송 |
| E2E-CHAT-003 | SPEC-READ-001 | AC-READ-001-3 | 다른 사용자 미읽음 상태에서 카운트 표시 |
| E2E-CHAT-004 | SPEC-READ-001 | AC-READ-001-4,5 | 읽음 처리 후 카운트 감소/소멸 |
| E2E-SEARCH-001 | SPEC-MSG-005 | AC-MSG-005-2 | 채팅방 내 검색 → 결과 2건 이상, 하이라이트(mark) 렌더링 |
| E2E-SEARCH-002 | SPEC-MSG-005 | AC-MSG-005-3 | 결과 없는 키워드 검색 → "검색 결과 없음" 표시 |
| E2E-SEARCH-003 | SPEC-MSG-005 | AC-MSG-005-1 | 발신자 필터 미선택 상태에서 빈 검색어 Enter 제출 → 오류 메시지 표시, API 미호출 |
| E2E-LOGIN-VALIDATION | SPEC-USR-001 | AC-USR-001-1 | 1자 닉네임 입력 → 에러 메시지 표시, POST /api/users 미호출, /login URL 유지 |
| E2E-ROOM-002-VALIDATION | SPEC-ROOM-002 | AC-ROOM-002-1 | 채팅방 이름 1자 입력 → 생성 버튼 비활성화(disabled) |
| E2E-ROOM-004 | SPEC-ROOM-004 | AC-ROOM-004-2, AC-ROOM-004-5, AC-ROOM-004-7 | 사이드바 → 채팅방 나가기 → 모달 팝업 나가기 버튼 클릭 → 목록 화면 복귀 |
| E2E-ROOM-004-CANCEL | SPEC-ROOM-004 | AC-ROOM-004-5, AC-ROOM-004-6 | 사이드바 → 채팅방 나가기 → 모달 취소 버튼 → 채팅방 화면 유지 |
| E2E-ROOM-HEADER-001 | SPEC-ROOM-003 | AC-ROOM-003-5, AC-ROOM-003-6 | 채팅방 헤더에 '채팅방 목록' 버튼 텍스트 표시 / 아바타 그룹 + 참여자 수 렌더링 / 뒤로가기 동작 |
| E2E-ROOM-SIDEBAR-SORT-001 | SPEC-ROOM-003 | AC-ROOM-003-7 | 사이드바 참여자 목록: 본인 최상단 + 나머지 사전순(숫자→영어→한글) 정렬 |
| E2E-STICKER-001 | SPEC-MSG-003 | AC-MSG-003-1,2 | 스티커 버튼 클릭 → 선택 모달 표시 → 스티커 선택 → 채팅창 렌더링, 모달 닫힘 |
| E2E-MSG-004 | SPEC-MSG-001 | AC-MSG-001-4 | 공백만 입력 → 전송 버튼 비활성화(disabled) |
| E2E-MSG-LAYOUT | SPEC-MSG-001 | AC-MSG-001-3 | 내 메시지 컨테이너에 `justify-end` 클래스 확인 (우측 정렬) |
| E2E-IMG-001 | SPEC-MSG-002 | AC-MSG-002-4 | 유효한 PNG 이미지 업로드 → 채팅창에 `img` 태그 렌더링 |
| E2E-IMG-002 | SPEC-MSG-002 | AC-MSG-002-1 | 5MB 초과 파일 선택 → "파일 크기가 5MB를 초과합니다." 경고, 이미지 미전송 |
| E2E-IMG-003 | SPEC-MSG-002 | AC-MSG-002-2 | 지원 외 형식(PDF) 선택 → "JPG, PNG, GIF 형식만 지원합니다." 경고, 이미지 미전송 |
| E2E-SEARCH-004 | SPEC-MSG-005 | - | 시스템 메시지 텍스트 검색 → "검색 결과 없음" (시스템 메시지 필터링 확인) |
| E2E-SEARCH-005 | SPEC-MSG-005 | - | 참가자 필터 선택 → 해당 참가자 메시지만 표시, 미전송 참가자 선택 시 "검색 결과 없음" |
| E2E-SEARCH-006 | SPEC-MSG-005 | - | 키워드 검색 후 참가자 필터 전환 → 교집합(AND) 결과만 표시 |
| E2E-SEARCH-007 | SPEC-MSG-005 | - | 참가자 필터 적용 시 메시지 버블의 발신자 이름에 `mark.bg-yellow-200` 하이라이팅 렌더링 |
| E2E-SEARCH-008 | SPEC-MSG-005 | AC-MSG-005-1b | 키워드 없이 발신자 필터만 적용 → 건수 표시, 화살표 활성화 / 미전송자 선택 시 화살표 비활성화 |
| E2E-SEARCH-009 | SPEC-MSG-005 | - | 캘린더 날짜 선택 → 검색어·발신자 필터 초기화 + 날짜 세퍼레이터 `rounded-full` 요소 표시 확인 |
| E2E-SEARCH-010 | SPEC-MSG-005 | AC-MSG-005-1b | 키워드+발신자 필터 복합 검색 중 키워드 제거 후 Enter → 오류 없이 발신자 단독 필터링으로 전환, 해당 발신자 메시지 건수 유지 |
| E2E-SEARCH-011 | SPEC-MSG-005 | AC-MSG-005-7 | 검색 결과 화살표로 이동 시 해당 메시지 버블에 `message-bounce` 애니메이션 적용 (노란 링 미적용) |
| E2E-JOIN-MSG-001 | SPEC-ROOM-003 | AC-ROOM-003-9 | 신규 입장 사용자에게 입장 이전 메시지 미표시, 입장 이후 메시지 표시 |
| E2E-JOIN-MSG-002 | SPEC-ROOM-003 | AC-ROOM-003-9 | 재입장 사용자에게 부재 중 메시지 미표시, 재입장 이후 메시지 표시 |
| E2E-ROOM-LIST-RT-001 | SPEC-ROOM-001 | AC-ROOM-001-9, AC-ROOM-001-10 | 다른 사용자 메시지 전송 시 채팅방 목록의 마지막 메시지와 읽지 않은 수가 새로고침 없이 실시간 갱신 |

---

### 미구현 (⬜ 테스트 없음 — 추가 권장)

> 아래 항목들은 커버리지 목표 달성을 위해 추가 작성이 필요한 테스트이다.
> 새 기능 구현 시 해당 SPEC의 인수 조건을 테스트로 먼저 작성할 것을 권장한다.

| 테스트 ID | 관련 SPEC | 인수 조건 | 검증 내용 | 우선순위 |
|-----------|-----------|-----------|-----------|---------|
| E2E-ROOM-LIST-RT-002 | SPEC-ROOM-001 | AC-ROOM-001-11 | 비활성 상태(탭 최소화)에서도 채팅방 목록의 실시간 갱신이 유지됨 | 🟡 보통 |
| E2E-ROOM-LIST-RT-003 | SPEC-ROOM-001 | AC-ROOM-001-12 | 이미지/스티커 메시지 수신 시 목록에 `[사진]`/`[스티커]`로 표시 (FE 단위 테스트 FE-ROOM-LIST-WS-005로 커버됨) | 🟢 낮음 |
| BE-MSG-SVC-001 | SPEC-MSG-001 | AC-MSG-001-4 | 공백만인 메시지 전송 시 예외 발생 | 🔴 높음 |
| BE-MSG-SVC-002 | SPEC-MSG-001 | - | 텍스트 메시지 전송 성공 → MessageResponse 반환 | 🔴 높음 |
| BE-MSG-SVC-003 | SPEC-MSG-001 | - | 채팅방 비멤버의 메시지 전송 시 예외 발생 | 🔴 높음 |
| BE-MSG-SVC-004 | SPEC-MSG-001 | - | 메시지 목록 조회 → 안읽은 수 포함 반환 | 🟡 보통 |
| BE-MSG-SVC-005 | SPEC-MSG-001 | - | 메시지 삭제 (소프트 삭제) — 본인 메시지만 가능 | 🟡 보통 |
| BE-MSG-SVC-006 | SPEC-MSG-002 | AC-MSG-002-1 | IMAGE 메시지 전송 → Attachment 저장 | 🟡 보통 |
| BE-API-ROOM-001 | SPEC-ROOM-002 | AC-ROOM-002-1 | POST /api/chat-rooms → 201 Created | 🟡 보통 |
| BE-API-ROOM-002 | SPEC-ROOM-003 | AC-ROOM-003-1 | POST /api/chat-rooms/{id}/join → 200 OK | 🟡 보통 |
| BE-API-ROOM-003 | SPEC-ROOM-004 | AC-ROOM-004-1 | DELETE /api/chat-rooms/{id}/leave → 200 OK | 🟡 보통 |
| BE-API-USR-001 | SPEC-USR-001 | AC-USR-001-2 | POST /api/users → 201 Created | 🟡 보통 |
| BE-API-READ-001 | SPEC-READ-001 | AC-READ-001-5 | POST /api/read-status → 200 OK | 🟡 보통 |
| FE-MSG-002 | SPEC-MSG-001 | AC-MSG-001-5 | WebSocket 미연결 시 전송 버튼 비활성화 | 🟡 보통 |
| E2E-AVATAR-COUNT-001 | SPEC-ROOM-001, SPEC-ROOM-003 | AC-ROOM-001-7, AC-ROOM-003-6 | 채팅방 목록/헤더 아바타: 본인 제외 활성 멤버 수에 따라 정확한 개수 렌더링 | 🟢 낮음 |
| E2E-AVATAR-INITIAL-001 | SPEC-ROOM-001, SPEC-ROOM-003 | AC-ROOM-001-8, AC-ROOM-003-8 | 프로필 이미지 없는 멤버의 아바타에 닉네임 첫 글자(대문자) 표시 | 🟢 낮음 |

---

## 테스트 작성 규칙

### 핵심 원칙: 구현과 테스트는 함께

> 핵심 비즈니스 로직(Domain Model, Domain Service, Application Service)을 **구현하거나 수정할 때**는
> 반드시 해당 코드를 커버하는 단위 테스트를 함께 작성한다.
> 테스트 없이 비즈니스 로직 코드를 병합(merge)하지 않는 것을 원칙으로 한다.

**체크리스트 (PR 머지 전 확인):**
- [ ] 새로 추가된 public 메서드에 대응하는 테스트가 존재하는가?
- [ ] 예외 발생 케이스(잘못된 입력, 존재하지 않는 엔티티)가 테스트되는가?
- [ ] `npm test -- --coverage` 실행 후 커버리지가 목표치를 충족하는가?

---

### 백엔드: 단위 테스트 패턴 (Jest + @nestjs/testing)

**도메인 모델 테스트 — 외부 의존 없음**

```typescript
describe('ChatRoom', () => {
  it('채팅방 이름 1자이면 예외', () => {
    const creator = new User('alice');
    expect(() => new ChatRoom('가', null, creator))
      .toThrow('채팅방 이름은 2자 이상이어야 합니다');
  });

  it('멤버 추가 성공', () => {
    // given
    const creator = new User('alice');
    (creator as any).id = 1;
    const other = new User('bob');
    (other as any).id = 2;
    const chatRoom = new ChatRoom('테스트방', null, creator);

    // when
    const result = chatRoom.addMember(other);

    // then
    expect(result).toBe(true);
    expect(chatRoom.getActiveMemberCount()).toBe(2);
  });
});
```

**애플리케이션 서비스 테스트 — Jest mock으로 의존성 격리**

```typescript
describe('ChatRoomApplicationService', () => {
  let service: ChatRoomApplicationService;
  let chatRoomRepository: jest.Mocked<IChatRoomRepository>;
  let userRepository: jest.Mocked<IUserRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ChatRoomApplicationService,
        { provide: 'IChatRoomRepository', useValue: { save: jest.fn(), findById: jest.fn() } },
        { provide: 'IUserRepository', useValue: { findById: jest.fn() } },
      ],
    }).compile();

    service = module.get(ChatRoomApplicationService);
    chatRoomRepository = module.get('IChatRoomRepository');
    userRepository = module.get('IUserRepository');
  });

  it('createChatRoom 성공', async () => {
    // given
    userRepository.findById.mockResolvedValue(creator);
    chatRoomRepository.save.mockResolvedValue(chatRoom);

    // when
    const response = await service.createChatRoom({ name: '새방', creatorId: 1 });

    // then
    expect(response).toBeDefined();
    expect(chatRoomRepository.save).toHaveBeenCalled();
  });

  it('createChatRoom 존재하지 않는 사용자 예외', async () => {
    // given
    userRepository.findById.mockResolvedValue(null);

    // when & then
    await expect(service.createChatRoom({ name: '방', creatorId: 999 }))
      .rejects.toThrow();
  });
});
```

**작성 규칙:**
- `describe` 블록명은 클래스명, `it` 블록명은 **한국어**로 의도를 명확히 기술한다
- 내부 구조는 `// given / // when / // then` 주석으로 구분한다
- `@nestjs/testing`의 `Test.createTestingModule()`로 DI 컨테이너를 구성한다
- ID 설정이 필요한 경우 `(entity as any).id = N`으로 설정한다

**통합 테스트 파일 규칙:**

```typescript
// *.e2e-spec.ts — MySQL 필요 시 e2e-spec 확장자 사용
describe('UserRepository (integration)', () => {
  // @nestjs/testing + 실제 DB 연결
  ...
});
```

---

### 프론트엔드: Vitest + RTL

```jsx
describe('Login 컴포넌트', () => {
  it('닉네임이 1자이면 오류 메시지를 표시한다', async () => {
    // given
    render(<Login onLoginSuccess={vi.fn()} />);
    const input = screen.getByPlaceholderText('닉네임 입력');
    const button = screen.getByRole('button', { name: '채팅 시작' });

    // when
    await userEvent.type(input, 'a');
    await userEvent.click(button);

    // then
    expect(screen.getByText('닉네임은 2자 이상이어야 합니다.')).toBeInTheDocument();
  });
});
```

---

## 커버리지 보고서 확인 방법

```bash
# 1. 테스트 실행 + 커버리지 보고서 생성
cd server/chat-server && npm test -- --coverage

# 2. 보고서 열기
#    server/chat-server/coverage/lcov-report/index.html
#    → 디렉토리별 라인/브랜치 커버리지 확인 가능

# 3. 최소 기준 검증 (jest.config.ts의 coverageThreshold)
#    → 기준 미달 시 테스트 실패로 자동 차단
```

**보고서 경로:**

| 파일 | 용도 |
|------|------|
| `server/chat-server/coverage/lcov-report/index.html` | 브라우저에서 직관적으로 확인 |
| `server/chat-server/coverage/lcov.info` | CI/CD 파이프라인 연동 |
| `server/api-server/coverage/lcov-report/index.html` | api-server 커버리지 확인 |
