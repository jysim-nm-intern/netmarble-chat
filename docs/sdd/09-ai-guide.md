# 09. AI 협업 가이드라인

← [목차로 돌아가기](../sdd-specification.md)

---

## 이 문서의 목적

본 가이드는 AI(Claude, GitHub Copilot 등)와 협업할 때 SDD 명세를 효과적으로 활용하는 방법을 정의합니다.
명세 기반 프롬프트를 사용하면 AI가 프로젝트 컨텍스트를 정확히 이해하고 일관된 코드를 생성합니다.

---

## 구현 우선순위

| 우선순위 | SPEC-ID | 기능 | 요구사항 분류 |
|---------|---------|------|--------------|
| P0 (필수) | SPEC-USR-001 | 닉네임 로그인 | 필수 |
| P0 (필수) | SPEC-ROOM-001~004 | 채팅방 CRUD + 입장/퇴장 | 필수 |
| P0 (필수) | SPEC-MSG-001 | 텍스트 메시지 실시간 송수신 | 필수 |
| P1 (필수) | SPEC-MSG-002~003 | 이미지/스티커 전송 | 필수 |
| P1 (필수) | SPEC-READ-001 | 읽음 처리 (미읽음 카운트) | 선택 도전 |
| P2 (선택) | SPEC-MSG-005 | 메시지 검색 | 선택 도전 |

---

## AI 프롬프트 템플릿

### 신규 기능 구현 요청

```
다음 SPEC을 구현해줘.

[SPEC-ID]: SPEC-MSG-005
[기능]: 메시지 검색

--- 명세 ---
[03-functional-specs.md의 SPEC-MSG-005 섹션 전체 붙여넣기]
--- 명세 끝 ---

구현 조건:
- 백엔드 구현 순서: Domain Entity → Repository → DTO → Service → Controller
- 코드 컨벤션: server/.claude/rules/code_convention.md 준수
  - DTO는 Java Record 사용
  - 의존성 주입은 @RequiredArgsConstructor
  - 예외는 GlobalExceptionHandler에서 처리
- 테스트: server/.claude/rules/test_convention.md 준수
  - BDD 패턴, @DisplayName 한국어
  - 핵심 비즈니스 로직(Domain, Application Service)은 단위 테스트를 반드시 포함한다
  - 정상 케이스와 예외 케이스(잘못된 입력, 존재하지 않는 엔티티)를 모두 테스트한다
  - @SpringBootTest를 사용하는 통합 테스트에는 @Tag("integration")을 추가한다
- 커버리지 기준 (SPEC-NFR-005 참조):
  - 도메인 모델: 80% 이상
  - 애플리케이션 서비스: 70% 이상
  - 구현 후 ./gradlew test jacocoTestReport 실행하여 기준 충족 확인
- 금지 사항: server/.claude/rules/anti_pattern.md 참조
```

### 버그 수정 요청

```
다음 SPEC의 인수 조건이 충족되지 않고 있어. 수정해줘.

[SPEC-ID]: SPEC-READ-001
[위반된 AC]: AC-READ-001-4
  - 기대: 참여자 2명일 때 상대가 읽으면 unreadCount가 0으로 사라진다.
  - 실제: 상대가 읽어도 unreadCount가 사라지지 않는다.

[관련 파일]: ReadStatusApplicationService.java, MessageList.jsx
```

### 테스트 코드 생성 요청

```
다음 테스트 케이스를 구현해줘.

[테스트 ID]: BE-SEARCH-001
[관련 SPEC]: SPEC-MSG-005 (AC-MSG-005-2)
[검증 내용]: 키워드 포함 메시지 2개 반환, 최신순 정렬
[테스트 대상 클래스]: MessageApplicationService

구현 조건:
- 도구: JUnit 5 + Mockito (@ExtendWith(MockitoExtension.class))
- 패턴: // given / // when / // then
- 메서드명: 한국어로 의도 명확하게 작성 (예: 키워드_포함_메시지_반환_최신순_정렬)
- 클래스에 public 키워드 생략
- 테스트 대상 계층별 접근:
  - Domain Model: 외부 Mock 없이 직접 생성자 호출
  - Application Service: @Mock + @InjectMocks 사용, 외부 의존성 모두 Mock 처리
  - ID 설정이 필요한 경우 Reflection 헬퍼(setId 메서드) 사용
- @SpringBootTest 사용 시 반드시 @Tag("integration") 추가
- 구현 완료 후 ./gradlew test jacocoTestReport 실행하여 커버리지 확인
```

---

## E2E 테스트 작성 가이드 (Playwright)

### 기본 규칙

- **테스트 이름은 반드시 한국어**로 작성한다.
- 형식: `[대상] [조건] [기대 동작]` — 예: `"닉네임 1자 입력 시 유효성 오류 표시 및 API 미호출"`
- 테스트 ID는 주석 블록으로 명시한다.
- 각 테스트는 독립적으로 고유한 테스트 데이터(timestamp 포함 닉네임/방 이름)를 사용한다.

### 테스트 이름 작성 패턴

```
[명사: 대상] + [조건절: ~시/~후/~하면] + [기대 결과: ~표시/~비활성화/~이동]
```

| 좋은 예 | 나쁜 예 (지양) |
|---|---|
| `'닉네임 1자 입력 시 유효성 오류 표시 및 API 미호출'` | `'nickname validation shows error for 1 character'` |
| `'채팅방 나가기 후 채팅방 목록으로 복귀'` | `'leave chat room and return to list'` |
| `'5MB 초과 파일 업로드 시 경고 표시'` | `'uploading file over 5MB shows alert'` |

### 파일 구조

```js
// ─────────────────────────────────────────────
// [테스트 ID] | [관련 SPEC]
// [인수 조건 ID]
// ─────────────────────────────────────────────
test('한국어로 작성한 테스트 설명', async ({ page }) => {
  // 준비 (arrange)

  // 실행 (act)

  // 검증 (assert)
});
```

### 공통 헬퍼 사용

```js
// WebSocket 연결 완료 대기
await waitForConnected(page);

// 로그인 → 채팅방 생성 → 연결까지 한 번에 셋업
const { nickname, roomName } = await setupChatRoom(page);

// API로 사용자/채팅방/입장 직접 생성
const user = await createUser(request, 'nickname');
const room = await createChatRoom(request, user.id, 'roomName');
await joinChatRoom(request, room.id, user.id);
```

### 셀렉터 우선순위

아래 순서로 셀렉터를 선택한다. 접근성 기반 셀렉터를 최우선으로 사용하며, CSS 클래스 직접 참조는 최소화한다.

| 우선순위 | 방법 | 예시 |
|---|---|---|
| 1 | `aria-label` | `page.getByRole('button', { name: '전송' })` |
| 2 | `label` 연결 | `page.getByLabel('닉네임')` |
| 3 | `placeholder` | `page.getByPlaceholder(/메시지를 입력하세요/)` |
| 4 | 화면 텍스트 | `page.getByText('스티커 선택')` |
| 5 | CSS 클래스 | `page.locator('span.text-amber-500')` ← 최후 수단 |

### 자주 쓰는 패턴

```js
// 버튼 비활성화 확인
await expect(page.getByRole('button', { name: '생성' })).toBeDisabled();

// URL 확인
await expect(page).toHaveURL(/\/login/);

// 요소 미표시 확인
await expect(page.locator('img[alt="..."]')).toHaveCount(0);

// WebSocket 연결 후 전송
await waitForConnected(page);
await page.getByPlaceholder(/메시지를 입력하세요/).fill('내용');
await page.getByRole('button', { name: '전송' }).click();

// alert() 캡처 (window.alert 스파이)
await page.evaluate(() => {
  window._capturedAlert = null;
  window.alert = (msg) => { window._capturedAlert = msg; };
});
// ... 동작 수행 ...
await page.waitForFunction(() => window._capturedAlert !== null, { timeout: 5000 });
const alertMsg = await page.evaluate(() => window._capturedAlert);
expect(alertMsg).toContain('기대 문자열');

// confirm 다이얼로그 자동 수락
page.on('dialog', (dialog) => dialog.accept());

// 파일 업로드 (실제 파일 없이 버퍼로)
await page.locator('input[type="file"]').setInputFiles({
  name: 'test.png',
  mimeType: 'image/png',
  buffer: Buffer.from('...'),
});
```

### E2E 테스트 생성 요청 템플릿

```
다음 E2E 테스트 케이스를 Playwright로 구현해줘.

[테스트 ID]: E2E-XXX-000
[관련 SPEC]: SPEC-XXX-000
[인수 조건]: AC-XXX-000-0
[테스트 이름 (한국어)]: "대상 + 조건 + 기대 동작"

시나리오:
1. [단계 1]
2. [단계 2]
3. [단계 3]

기대 결과:
- [결과 1]
- [결과 2]

구현 조건:
- 테스트 이름은 한국어로 작성
- 테스트 ID를 주석 블록으로 명시
- 공통 헬퍼(waitForConnected, setupChatRoom 등) 활용
- 셀렉터는 aria-label / label / placeholder 우선 사용
- 각 테스트는 Date.now() 기반 고유 데이터 사용
```

---

## AI 응답 검증 체크리스트

AI가 생성한 코드를 검토할 때 다음 항목을 확인한다.

### 기능 명세 준수

- [ ] 출력 계약의 응답 필드가 모두 포함되어 있는가?
- [ ] 모든 인수 조건(AC)이 코드에 반영되었는가?
- [ ] 실시간 메시지 전송이 REST가 아닌 STOMP로 구현되었는가?

### 아키텍처 준수

- [ ] Controller → Service → Repository 순서로 계층이 분리되었는가?
- [ ] Controller에서 Repository를 직접 호출하지 않는가?
- [ ] JPA Entity를 API 응답으로 직접 반환하지 않는가? (DTO 변환 확인)
- [ ] 의존성 주입이 `@RequiredArgsConstructor + final`로 되어 있는가?

### 예외 처리

- [ ] 잘못된 입력(4xx)이 `GlobalExceptionHandler`에서 처리되는가?
- [ ] 오류 응답 형식이 `{ success, data, error }` Wrapper를 따르는가?
- [ ] `System.out.println` 대신 `log.info()` / `log.error()`를 사용하는가?

### 테스트 코드 및 커버리지

- [ ] `// given / // when / // then` 구조로 작성되었는가?
- [ ] 테스트 메서드명이 한국어로 의도를 명확하게 기술하는가?
- [ ] 정상 케이스와 예외 케이스(잘못된 입력, 존재하지 않는 엔티티)가 모두 커버되는가?
- [ ] Domain Model의 모든 도메인 로직(유효성 검증, 상태 변경)이 테스트되는가?
- [ ] Application Service의 주요 유즈케이스(성공/실패 분기)가 테스트되는가?
- [ ] `@SpringBootTest`를 사용하는 통합 테스트에 `@Tag("integration")`이 추가되었는가?
- [ ] `./gradlew test jacocoTestReport` 실행 후 목표 커버리지(SPEC-NFR-005)를 충족하는가?
  - `domain.model`: 80% 이상
  - `domain.service`: 90% 이상
  - `application.service`: 70% 이상

---

## 명세 변경 절차

명세를 변경해야 할 경우 아래 순서를 따른다.

```
1. 해당 SPEC 파일 수정 (SPEC-ID는 유지, 내용만 변경)
2. 연관 테스트 ID 목록 확인 (08-test-specs.md)
3. 변경된 명세를 AI에게 전달하여 코드 재생성
4. 기존 테스트를 실행하여 인수 조건 통과 확인
5. 필요 시 테스트 케이스도 명세에 맞게 업데이트
```

---

## 개발 흐름 요약

```
명세 확인 (이 문서) → AI 프롬프트 작성 → 코드 생성 + 단위 테스트 작성
       ↑                                              ↓
명세 업데이트 (필요 시) ← 검증 (체크리스트) ← 커버리지 확인 ← 테스트 실행
```

### 비즈니스 로직 구현 시 필수 절차

```
1. SPEC 확인 (03-functional-specs.md 해당 SPEC 섹션)
       ↓
2. 구현 대상 식별
   - Domain Model 변경?  → Model 단위 테스트 작성
   - Application Service 변경?  → Service 단위 테스트 작성
       ↓
3. 코드 구현 (Domain → Repository → DTO → Service → Controller)
       ↓
4. 테스트 실행 및 커버리지 확인
   $ cd server && ./gradlew test jacocoTestReport
   → server/build/reports/jacoco/test/html/index.html 확인
       ↓
5. 커버리지 기준 미달 시 테스트 보완 (SPEC-NFR-005 참조)
   - domain.model: 80% / domain.service: 90% / application.service: 70%
       ↓
6. 08-test-specs.md의 SPEC → 테스트 ID 매핑 테이블 업데이트
```
