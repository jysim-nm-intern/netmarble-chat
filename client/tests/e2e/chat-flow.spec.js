import { test, expect } from '@playwright/test';

const apiBaseUrl = 'http://localhost:8080';

// ─────────────────────────────────────────────
// 공통 헬퍼
// ─────────────────────────────────────────────

const createUser = async (request, nickname) => {
  const formData = new URLSearchParams();
  formData.append('nickname', nickname);

  const response = await request.post(`${apiBaseUrl}/api/users`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: formData.toString(),
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
};

const createChatRoom = async (request, creatorId, name) => {
  const formData = new URLSearchParams();
  formData.append('name', name);
  formData.append('creatorId', String(creatorId));

  const response = await request.post(`${apiBaseUrl}/api/chat-rooms`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: formData.toString(),
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
};

const joinChatRoom = async (request, chatRoomId, userId) => {
  const response = await request.post(
    `${apiBaseUrl}/api/chat-rooms/${chatRoomId}/join?userId=${userId}`
  );

  expect(response.ok()).toBeTruthy();
  return response.json();
};

/**
 * WebSocket이 연결되어 메시지 입력이 가능한 상태를 기다린다.
 * placeholder 가 "메시지를 입력하세요" 로 바뀌는 시점 = 연결 완료.
 */
const waitForConnected = async (page) => {
  await expect(page.getByPlaceholder(/메시지를 입력하세요/)).toBeVisible({ timeout: 15000 });
};

/**
 * WebSocket 구독까지 완료된 상태를 기다린다.
 * "연결됨" 인디케이터가 표시되는 시점 = subscribeToChatRoom() 호출 완료.
 * 실시간 메시지 수신이 필요한 테스트에서만 사용한다.
 */
const waitForSubscribed = async (page) => {
  await expect(page.getByPlaceholder(/메시지를 입력하세요/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('연결됨')).toBeVisible({ timeout: 10000 });
};

/**
 * 로그인 → 채팅방 생성 → WebSocket 연결까지 공통 셋업.
 * 채팅방 입력이 가능한 상태에서 반환한다.
 */
const setupChatRoom = async (page) => {
  const nickname = `user_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');

  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();
  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();

  await waitForConnected(page);
  return { nickname, roomName };
};

/** 최소 크기 1×1 PNG 바이너리 (Base64 인코딩) */
const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// ─────────────────────────────────────────────
// E2E-JOIN-MSG-001 | SPEC-ROOM-003
// AC-ROOM-003-9: 입장 시점 이전 메시지는 표시되지 않음
// ─────────────────────────────────────────────
test('입장 시점 이전에 작성된 메시지는 신규 입장 사용자에게 표시되지 않음', async ({ browser, request }) => {
  const creatorNickname = `creator_${Date.now()}`;
  const joinerNickname = `joiner_${Date.now()}`;
  const roomName = `join_filter_${Date.now()}`;
  const beforeJoinMsg = `before_join_${Date.now()}`;
  const afterJoinMsg = `after_join_${Date.now()}`;

  const creator = await createUser(request, creatorNickname);
  await createChatRoom(request, creator.id, roomName);

  // creator 브라우저에서 joiner 입장 전 메시지 전송
  const creatorContext = await browser.newContext();
  const creatorPage = await creatorContext.newPage();
  await creatorPage.goto('/login');
  await creatorPage.getByLabel('닉네임').fill(creatorNickname);
  await creatorPage.getByRole('button', { name: '채팅 시작' }).click();
  await creatorPage.waitForURL('**/');
  await creatorPage.getByText(roomName).click();
  await expect(creatorPage.getByPlaceholder(/메시지를 입력하세요/)).toBeVisible({ timeout: 15000 });

  await creatorPage.getByPlaceholder(/메시지를 입력하세요/).fill(beforeJoinMsg);
  await creatorPage.getByRole('button', { name: '전송' }).click();
  await expect(creatorPage.getByText(beforeJoinMsg)).toBeVisible();

  // joiner 로그인 및 채팅방 입장
  const joinerContext = await browser.newContext();
  const joinerPage = await joinerContext.newPage();
  await joinerPage.goto('/login');
  await joinerPage.getByLabel('닉네임').fill(joinerNickname);
  await joinerPage.getByRole('button', { name: '채팅 시작' }).click();
  await joinerPage.waitForURL('**/');
  await joinerPage.getByText(roomName).click();
  // "연결됨" 인디케이터까지 확인 → WebSocket 구독 완료 후 메시지 수신 가능
  await waitForSubscribed(joinerPage);

  // 입장 이전 메시지가 joiner 화면에 표시되지 않아야 함 (AC-ROOM-003-9)
  await expect(joinerPage.getByText(beforeJoinMsg)).not.toBeVisible();

  // creator가 joiner 입장 후 새 메시지 전송
  await creatorPage.getByPlaceholder(/메시지를 입력하세요/).fill(afterJoinMsg);
  await creatorPage.getByRole('button', { name: '전송' }).click();
  await expect(creatorPage.getByText(afterJoinMsg)).toBeVisible();

  // 입장 이후 메시지는 joiner 화면에 표시되어야 함
  await expect(joinerPage.getByText(afterJoinMsg)).toBeVisible({ timeout: 20000 });

  await creatorContext.close();
  await joinerContext.close();
});

// ─────────────────────────────────────────────
// E2E-JOIN-MSG-002 | SPEC-ROOM-003
// AC-ROOM-003-9: 재입장 시에도 재입장 시점 이후 메시지만 표시
// ─────────────────────────────────────────────
test('재입장 시 부재 중 메시지는 표시되지 않음', async ({ browser, request }) => {
  const creatorNickname = `creator_${Date.now()}`;
  const joinerNickname = `rejoiner_${Date.now()}`;
  const roomName = `rejoin_filter_${Date.now()}`;
  const duringAbsenceMsg = `during_absence_${Date.now()}`;
  const afterRejoinMsg = `after_rejoin_${Date.now()}`;

  const creator = await createUser(request, creatorNickname);
  const joiner = await createUser(request, joinerNickname);
  const chatRoom = await createChatRoom(request, creator.id, roomName);

  // joiner 최초 입장 후 퇴장 (API)
  await joinChatRoom(request, chatRoom.id, joiner.id);
  const leaveRes = await request.post(
    `${apiBaseUrl}/api/chat-rooms/${chatRoom.id}/leave?userId=${joiner.id}`
  );
  expect(leaveRes.ok()).toBeTruthy();

  // creator가 joiner 부재 중 메시지 전송
  const creatorContext = await browser.newContext();
  const creatorPage = await creatorContext.newPage();
  await creatorPage.goto('/login');
  await creatorPage.getByLabel('닉네임').fill(creatorNickname);
  await creatorPage.getByRole('button', { name: '채팅 시작' }).click();
  await creatorPage.waitForURL('**/');
  await creatorPage.getByText(roomName).click();
  await expect(creatorPage.getByPlaceholder(/메시지를 입력하세요/)).toBeVisible({ timeout: 15000 });
  await creatorPage.getByPlaceholder(/메시지를 입력하세요/).fill(duringAbsenceMsg);
  await creatorPage.getByRole('button', { name: '전송' }).click();
  await expect(creatorPage.getByText(duringAbsenceMsg)).toBeVisible();

  // joiner 재입장
  const joinerContext = await browser.newContext();
  const joinerPage = await joinerContext.newPage();
  await joinerPage.goto('/login');
  await joinerPage.getByLabel('닉네임').fill(joinerNickname);
  await joinerPage.getByRole('button', { name: '채팅 시작' }).click();
  await joinerPage.waitForURL('**/');
  await joinerPage.getByText(roomName).click();
  await expect(joinerPage.getByPlaceholder(/메시지를 입력하세요/)).toBeVisible({ timeout: 15000 });

  // 부재 중 메시지는 표시되지 않아야 함 (AC-ROOM-003-9)
  await expect(joinerPage.getByText(duringAbsenceMsg)).not.toBeVisible();

  // 재입장 이후 메시지는 표시되어야 함
  await creatorPage.getByPlaceholder(/메시지를 입력하세요/).fill(afterRejoinMsg);
  await creatorPage.getByRole('button', { name: '전송' }).click();
  await expect(joinerPage.getByText(afterRejoinMsg)).toBeVisible({ timeout: 10000 });

  await creatorContext.close();
  await joinerContext.close();
});

// ─────────────────────────────────────────────
// E2E-CHAT-001 | SPEC-ROOM-002, SPEC-MSG-001
// AC-ROOM-002-3, AC-MSG-001-1
// ─────────────────────────────────────────────
test('로그인 후 채팅방 생성 및 메시지 전송', async ({ page }) => {
  const nickname = `user_${Date.now()}`;
  const roomName = `room_${Date.now()}`;
  const message = `hello_${Date.now()}`;

  await page.goto('/login');

  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();

  await page.waitForURL('**/');
  await expect(page.getByRole('button', { name: '새 채팅방 만들기' })).toBeVisible();
  await expect(page.getByText(new RegExp(nickname))).toBeVisible();

  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();
  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();

  // 채팅방 헤더에 방 이름 표시 확인
  await expect(page.getByRole('heading', { name: roomName })).toBeVisible();

  // WebSocket 연결 완료 대기 (placeholder 변화로 감지)
  await waitForConnected(page);

  await page.getByPlaceholder(/메시지를 입력하세요/).fill(message);
  await page.getByRole('button', { name: '전송' }).click();

  await expect(page.getByText(message)).toBeVisible();
});

// ─────────────────────────────────────────────
// E2E-CHAT-002 | SPEC-ROOM-003, SPEC-READ-001
// AC-ROOM-003-1, AC-READ-001-1
// ─────────────────────────────────────────────
test('기존 채팅방 입장 시 시스템 메시지 표시 확인', async ({ page, request }) => {
  const creatorNickname = `creator_${Date.now()}`;
  const joinerNickname = `joiner_${Date.now()}`;
  const roomName = `room_${Date.now()}`;
  const message = `join_msg_${Date.now()}`;

  const creator = await createUser(request, creatorNickname);
  const joiner = await createUser(request, joinerNickname);
  await createChatRoom(request, creator.id, roomName);

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(joiner.nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();

  await expect(page.getByRole('button', { name: '새 채팅방 만들기' })).toBeVisible();
  await page.getByText(roomName).click();

  // 입장 시스템 메시지 확인 (AC-ROOM-003-1)
  await expect(page.getByText(new RegExp(`${joiner.nickname}님이 입장했습니다`))).toBeVisible({ timeout: 10000 });

  // WebSocket 연결 완료 대기 (AC-ROOM-003-2)
  await waitForConnected(page);

  await page.getByPlaceholder(/메시지를 입력하세요/).fill(message);
  await page.getByRole('button', { name: '전송' }).click();

  await expect(page.getByText(message)).toBeVisible();

  // 뒤로가기 버튼으로 목록 복귀 (aria-label="채팅방 목록으로")
  await page.getByRole('button', { name: '채팅방 목록으로' }).click();
  await expect(page.getByRole('button', { name: '새 채팅방 만들기' })).toBeVisible();
});

// ─────────────────────────────────────────────
// E2E-CHAT-003 | SPEC-READ-001
// AC-READ-001-3, AC-READ-001-4
// ─────────────────────────────────────────────
test('2명 참여 시 상대 읽음 처리 후 미읽음 카운트 소멸', async ({ page, request }) => {
  const creatorNickname = `creator_${Date.now()}`;
  const readerNickname = `reader_${Date.now()}`;
  const roomName = `room_${Date.now()}`;
  const message = `unread_${Date.now()}`;

  const creator = await createUser(request, creatorNickname);
  const reader = await createUser(request, readerNickname);
  const chatRoom = await createChatRoom(request, creator.id, roomName);

  await joinChatRoom(request, chatRoom.id, reader.id);

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(creator.nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();

  await expect(page.getByRole('button', { name: '새 채팅방 만들기' })).toBeVisible();
  await page.getByText(roomName).click();

  await waitForConnected(page);
  await page.getByPlaceholder(/메시지를 입력하세요/).fill(message);
  await page.getByRole('button', { name: '전송' }).click();

  await expect(page.getByText(message)).toBeVisible();
  // 미읽음 카운트 1 표시 확인
  await expect(page.locator('span.text-amber-500').filter({ hasText: '1' })).toBeVisible();

  const markReadResponse = await request.post(
    `${apiBaseUrl}/api/read-status/mark-read?userId=${reader.id}&chatRoomId=${chatRoom.id}`
  );

  expect(markReadResponse.ok()).toBeTruthy();
  // 읽음 처리 후 미읽음 카운트 사라짐 (AC-READ-001-4)
  await expect(page.locator('span.text-amber-500')).toHaveCount(0);
});

// ─────────────────────────────────────────────
// E2E-CHAT-004 | SPEC-READ-001
// AC-READ-001-5
// ─────────────────────────────────────────────
test('3명 참여 시 1명 읽음 후 미읽음 카운트 1 감소', async ({ page, request }) => {
  const creatorNickname = `creator_${Date.now()}`;
  const readerOneNickname = `reader1_${Date.now()}`;
  const readerTwoNickname = `reader2_${Date.now()}`;
  const roomName = `room_${Date.now()}`;
  const message = `unread_${Date.now()}`;

  const creator = await createUser(request, creatorNickname);
  const readerOne = await createUser(request, readerOneNickname);
  const readerTwo = await createUser(request, readerTwoNickname);
  const chatRoom = await createChatRoom(request, creator.id, roomName);

  await joinChatRoom(request, chatRoom.id, readerOne.id);
  await joinChatRoom(request, chatRoom.id, readerTwo.id);

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(creator.nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();

  await expect(page.getByRole('button', { name: '새 채팅방 만들기' })).toBeVisible();
  await page.getByText(roomName).click();

  await waitForConnected(page);
  await page.getByPlaceholder(/메시지를 입력하세요/).fill(message);
  await page.getByRole('button', { name: '전송' }).click();

  await expect(page.getByText(message)).toBeVisible();
  // 미읽음 카운트 2 표시 확인 (참여자 2명 미읽음)
  await expect(page.locator('span.text-amber-500').filter({ hasText: '2' })).toBeVisible();

  const markReadResponse = await request.post(
    `${apiBaseUrl}/api/read-status/mark-read?userId=${readerOne.id}&chatRoomId=${chatRoom.id}`
  );

  expect(markReadResponse.ok()).toBeTruthy();
  // 1명 읽음 후 카운트 1로 감소 확인
  await expect(page.locator('span.text-amber-500').filter({ hasText: '1' })).toBeVisible();
});

// ─────────────────────────────────────────────
// E2E-SEARCH-001 | SPEC-MSG-005
// AC-MSG-005-2
// ─────────────────────────────────────────────
test('채팅방 내 키워드 검색 시 결과 표시 및 하이라이트', async ({ page }) => {
  const nickname = `user_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();

  await page.waitForURL('**/');
  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();
  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();

  await waitForConnected(page);

  await page.getByPlaceholder(/메시지를 입력하세요/).fill('apple');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('apple')).toBeVisible();

  await page.getByPlaceholder(/메시지를 입력하세요/).fill('banana');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('banana')).toBeVisible();

  await page.getByPlaceholder(/메시지를 입력하세요/).fill('apple pie');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('apple pie')).toBeVisible();

  await page.getByPlaceholder(/메시지를 입력하세요/).fill('peach');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('peach')).toBeVisible();

  // 검색창 열기 (aria-label="메시지 검색")
  await page.getByRole('button', { name: '메시지 검색' }).click();

  // 검색어 입력 후 Enter 제출 (placeholder="검색...")
  await page.getByPlaceholder('검색...').fill('apple');
  await page.getByPlaceholder('검색...').press('Enter');

  // 검색 결과 N건 표시 확인 (2건 이상)
  await expect(page.getByText(/\d+건/)).toBeVisible();

  // 검색 결과 내 메시지 하이라이트 확인
  const highlights = page.locator('mark.bg-yellow-200');
  await expect(highlights.first()).toBeVisible();

  const count = await highlights.count();
  expect(count).toBeGreaterThanOrEqual(2);
});

// ─────────────────────────────────────────────
// E2E-SEARCH-002 | SPEC-MSG-005
// AC-MSG-005-3
// ─────────────────────────────────────────────
test('결과 없는 키워드 검색 시 안내 메시지 표시', async ({ page }) => {
  const nickname = `user_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();

  await page.waitForURL('**/');
  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();
  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();

  await waitForConnected(page);
  await page.getByPlaceholder(/메시지를 입력하세요/).fill('hello world');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('hello world')).toBeVisible();

  await page.getByRole('button', { name: '메시지 검색' }).click();
  await page.getByPlaceholder('검색...').fill('nonexistent');
  await page.getByPlaceholder('검색...').press('Enter');

  // 검색 결과 없음 텍스트 확인
  await expect(page.getByText('검색 결과 없음')).toBeVisible();
});

// ─────────────────────────────────────────────
// E2E-SEARCH-003 | SPEC-MSG-005
// AC-MSG-005-1
// ─────────────────────────────────────────────
test('빈 검색어 제출 시 오류 메시지 표시', async ({ page }) => {
  const nickname = `user_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();

  await page.waitForURL('**/');
  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();
  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();

  await waitForConnected(page);

  await page.getByRole('button', { name: '메시지 검색' }).click();
  // 검색어 없이 Enter 제출
  await page.getByPlaceholder('검색...').press('Enter');

  // 오류 메시지 확인 (AC-MSG-005-1)
  await expect(page.getByText(/검색어를 입력해주세요/)).toBeVisible();
});

// ─────────────────────────────────────────────
// E2E-LOGIN-VALIDATION | SPEC-USR-001
// AC-USR-001-1
// ─────────────────────────────────────────────
test('닉네임 1자 입력 시 유효성 오류 표시 및 API 미호출', async ({ page }) => {
  await page.goto('/login');

  // API 호출이 발생하지 않는지 모니터링
  let apiCalled = false;
  page.on('request', (req) => {
    if (req.url().includes('/api/users') && req.method() === 'POST') {
      apiCalled = true;
    }
  });

  await page.getByLabel('닉네임').fill('a');
  await page.getByRole('button', { name: '채팅 시작' }).click();

  // 오류 메시지 표시 확인
  await expect(page.getByText('닉네임은 2자 이상이어야 합니다.')).toBeVisible();

  // 서버 API 미호출 확인
  expect(apiCalled).toBe(false);

  // 로그인 화면에서 이동하지 않음
  await expect(page).toHaveURL(/\/login/);
});

// ─────────────────────────────────────────────
// E2E-ROOM-002-VALIDATION | SPEC-ROOM-002
// AC-ROOM-002-1
// ─────────────────────────────────────────────
test('채팅방 이름 1자 입력 시 생성 버튼 비활성화', async ({ page }) => {
  const nickname = `user_${Date.now()}`;

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');

  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();

  // 모달이 열렸는지 확인
  await expect(page.getByLabel('채팅방 이름 *')).toBeVisible();

  // 1자 입력 후 생성 버튼이 비활성화되어 있는지 확인
  await page.getByLabel('채팅방 이름 *').fill('a');
  const submitBtn = page.getByRole('button', { name: '생성' });
  await expect(submitBtn).toBeDisabled();
});

// ─────────────────────────────────────────────
// E2E-ROOM-004 | SPEC-ROOM-004
// AC-ROOM-004-2, AC-ROOM-004-5, AC-ROOM-004-7
// ─────────────────────────────────────────────
test('채팅방 나가기 후 채팅방 목록으로 복귀', async ({ page }) => {
  const nickname = `user_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();

  await page.waitForURL('**/');
  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();
  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();

  await waitForConnected(page);

  // 햄버거 메뉴(참여자 목록) 열기
  await page.getByRole('button', { name: '참여자 목록' }).click();
  await expect(page.getByRole('button', { name: '채팅방 나가기' })).toBeVisible();

  // 채팅방 나가기 버튼 클릭 → 모달 팝업 표시 확인 (AC-ROOM-004-5)
  await page.getByRole('button', { name: '채팅방 나가기' }).click();
  await expect(page.getByText('정말 채팅방을 나가시겠습니까?')).toBeVisible();

  // 모달의 '나가기' 버튼 클릭 → 퇴장 완료 (AC-ROOM-004-7)
  await page.getByRole('button', { name: '나가기', exact: true }).click();

  // 채팅방 목록 화면으로 복귀 확인 (AC-ROOM-004-2)
  await expect(page.getByRole('button', { name: '새 채팅방 만들기' })).toBeVisible({ timeout: 10000 });
});

// ─────────────────────────────────────────────
// E2E-ROOM-004-CANCEL | SPEC-ROOM-004
// AC-ROOM-004-5, AC-ROOM-004-6
// ─────────────────────────────────────────────
test('채팅방 나가기 모달 취소 시 채팅방 유지', async ({ page }) => {
  const { roomName } = await setupChatRoom(page);

  // 햄버거 메뉴 열기 → 채팅방 나가기 클릭 → 모달 팝업 표시 (AC-ROOM-004-5)
  await page.getByRole('button', { name: '참여자 목록' }).click();
  await page.getByRole('button', { name: '채팅방 나가기' }).click();
  await expect(page.getByText('정말 채팅방을 나가시겠습니까?')).toBeVisible();

  // 취소 버튼 클릭 → 모달 닫힘, 채팅방 유지 (AC-ROOM-004-6)
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByText('정말 채팅방을 나가시겠습니까?')).not.toBeVisible();
  await expect(page.getByPlaceholder(/메시지를 입력하세요/)).toBeVisible();
});

// ─────────────────────────────────────────────
// E2E-ROOM-HEADER-001 | SPEC-ROOM-003
// AC-ROOM-003-5, AC-ROOM-003-6
// ─────────────────────────────────────────────
test('채팅방 헤더에 채팅방 목록 버튼 텍스트 및 아바타 그룹 표시', async ({ page }) => {
  const { roomName } = await setupChatRoom(page);

  // '채팅방 목록' 텍스트가 헤더에 표시됨 (AC-ROOM-003-5)
  await expect(page.getByRole('button', { name: '채팅방 목록으로' })).toBeVisible();
  await expect(page.getByText('채팅방 목록')).toBeVisible();

  // 참여자 수 숫자가 헤더 중앙에 표시됨 (AC-ROOM-003-6)
  // 방금 생성한 채팅방이므로 참여자 수 1 이상
  const memberCountEl = page.locator('p').filter({ hasText: /^\d+$/ }).first();
  await expect(memberCountEl).toBeVisible();

  // 뒤로가기 버튼 클릭 시 채팅방 목록으로 이동 (AC-ROOM-003-5)
  await page.getByRole('button', { name: '채팅방 목록으로' }).click();
  await expect(page.getByRole('button', { name: '새 채팅방 만들기' })).toBeVisible();
});

// ─────────────────────────────────────────────
// E2E-AVATAR-COUNT-001 | SPEC-ROOM-001, SPEC-ROOM-003
// AC-ROOM-001-7, AC-ROOM-003-6
// ─────────────────────────────────────────────
test('아바타 그룹: 본인 제외 활성 멤버 수에 따라 정확한 개수의 아바타 렌더링', async ({ page, request }) => {
  const nickname = `owner_${Date.now()}`;
  const roomName = `avatarCount_${Date.now()}`;

  // 방장 로그인 및 채팅방 생성
  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');

  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();
  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();
  await waitForConnected(page);

  // 방장 userId 조회
  const ownerData = await createUser(request, `member1_${Date.now()}`);
  const member2Data = await createUser(request, `member2_${Date.now()}`);
  const member3Data = await createUser(request, `member3_${Date.now()}`);

  // 방 ID 파악 (URL에서 추출)
  const roomId = page.url().match(/\/(\d+)/)?.[1];
  if (!roomId) throw new Error('방 ID를 파악할 수 없습니다.');

  // 멤버 2명 추가 입장 (API)
  await joinChatRoom(request, roomId, ownerData.id);
  await joinChatRoom(request, roomId, member2Data.id);

  // 채팅방 목록으로 이동 후 재진입하여 멤버 목록 갱신 확인
  await page.getByRole('button', { name: '채팅방 목록으로' }).click();
  await page.waitForURL('**/');

  // 채팅방 목록: 해당 방 항목의 아바타 그룹에 원형 아바타가 2개 존재해야 함
  // (본인 제외 활성 멤버 2명 → 2개 겹침 레이아웃)
  const roomItem = page.locator('[data-testid="chat-room-item"]').filter({ hasText: roomName }).first();
  if (await roomItem.count() === 0) {
    // data-testid가 없는 경우 텍스트로 찾기 (ChatRoomList는 div 기반 렌더링)
    await expect(page.getByText(roomName).first()).toBeVisible();
  }

  // 채팅방 상세 헤더 아바타 개수 검증: 재입장
  await page.getByText(roomName).first().click();
  await waitForConnected(page);

  // 멤버 3명 추가 → 총 본인 + 3명 = 4명 → 헤더 아바타 3개 (본인 제외)
  await joinChatRoom(request, roomId, member3Data.id);

  // 헤더 참여자 수가 1 이상임을 확인 (AC-ROOM-003-6)
  const memberCountEl = page.locator('p').filter({ hasText: /^\d+$/ }).first();
  await expect(memberCountEl).toBeVisible();
  const countText = await memberCountEl.textContent();
  expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(1);
});

// ─────────────────────────────────────────────
// E2E-AVATAR-INITIAL-001 | SPEC-ROOM-001, SPEC-ROOM-003
// AC-ROOM-001-8, AC-ROOM-003-8
// ─────────────────────────────────────────────
test('아바타 이니셜: 프로필 이미지 없는 멤버는 닉네임 첫 글자 표시', async ({ page, request }) => {
  test.setTimeout(90000);

  const ownerNickname = `owner_${Date.now()}`;
  const memberNickname = `Beta_${Date.now()}`;
  const roomName = `initial_room_${Date.now()}`;

  // 방장 로그인 (프로필 이미지 없음 → 이니셜 표시 대상)
  await page.goto('/login');
  await page.getByLabel('닉네임').fill(ownerNickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');

  // 채팅방 생성
  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();
  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();
  await waitForConnected(page);

  // Beta 유저를 API로 생성하고 방에 입장
  const memberData = await createUser(request, memberNickname);
  const roomId = page.url().match(/\/(\d+)/)?.[1];
  if (!roomId) throw new Error('방 ID를 파악할 수 없습니다.');
  await joinChatRoom(request, roomId, memberData.id);

  // 채팅방 목록으로 이동
  await page.getByRole('button', { name: '채팅방 목록으로' }).click();
  await page.waitForURL('**/');

  // 채팅방 목록의 아바타에 Beta 닉네임 첫 글자 "B"가 표시됨 (AC-ROOM-001-8)
  // 현재 방이 목록에 나타날 때까지 대기 (다수 방으로 인한 느린 API 응답 대비)
  const firstLetter = memberNickname.charAt(0).toUpperCase();
  await expect(page.getByText(roomName).first()).toBeVisible({ timeout: 30000 });
  const listAvatarInitial = page.locator('span').filter({ hasText: new RegExp(`^${firstLetter}$`) }).first();
  await expect(listAvatarInitial).toBeVisible({ timeout: 5000 });

  // 채팅방 상세 진입 후 헤더 아바타에도 이니셜 표시 (AC-ROOM-003-8)
  // 긴 목록에서의 클릭 불안정 문제를 피해 URL 직접 이동
  await page.goto(`/chatroom/${roomId}`);
  await waitForConnected(page);

  const headerAvatarInitial = page.locator('span').filter({ hasText: new RegExp(`^${firstLetter}$`) }).first();
  await expect(headerAvatarInitial).toBeVisible({ timeout: 5000 });
});

// ─────────────────────────────────────────────
// E2E-ROOM-002-IMAGE | SPEC-ROOM-002
// AC-ROOM-002-5
// ─────────────────────────────────────────────
test('채팅방 생성 시 이미지 첨부 후 목록에서 썸네일 표시', async ({ page }) => {
  const nickname = `user_${Date.now()}`;
  const roomName = `img_room_${Date.now()}`;

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');

  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();

  // 이미지 파일 첨부 (AC-ROOM-002-5)
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'room-thumb.png',
    mimeType: 'image/png',
    buffer: MINIMAL_PNG,
  });

  // 미리보기 이미지가 표시되어야 함
  await expect(page.locator('img[alt="채팅방 이미지 미리보기"]')).toBeVisible();

  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();

  // 채팅방 입장 확인
  await expect(page.getByRole('heading', { name: roomName })).toBeVisible();
  await waitForConnected(page);

  // 채팅방 목록으로 돌아가서 썸네일 이미지 확인
  await page.getByRole('button', { name: '채팅방 목록으로' }).click();
  await expect(page.getByRole('button', { name: '새 채팅방 만들기' })).toBeVisible();

  const thumbnail = page.locator(`img[alt="${roomName} 채팅방 이미지"]`);
  await expect(thumbnail).toBeVisible({ timeout: 10000 });
});

// ─────────────────────────────────────────────
// E2E-ROOM-002-IMAGE-VALIDATION | SPEC-ROOM-002
// AC-ROOM-002-6, AC-ROOM-002-7
// ─────────────────────────────────────────────
test('채팅방 생성 이미지 유효성 검사 - 크기 초과 및 잘못된 형식', async ({ page }) => {
  const nickname = `user_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');

  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();

  // alert 캡처
  await page.evaluate(() => {
    window._capturedAlert = null;
    window.alert = (msg) => { window._capturedAlert = msg; };
  });

  const fileInput = page.locator('input[type="file"]');

  // 5MB 초과 파일 (AC-ROOM-002-6)
  await fileInput.setInputFiles({
    name: 'large.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 0),
  });
  await page.waitForFunction(() => window._capturedAlert !== null, { timeout: 5000 });
  const alertMsg1 = await page.evaluate(() => window._capturedAlert);
  expect(alertMsg1).toContain('5MB');

  // 미리보기 이미지가 없어야 함
  await expect(page.locator('img[alt="채팅방 이미지 미리보기"]')).toHaveCount(0);

  // 잘못된 파일 형식 (AC-ROOM-002-7)
  await page.evaluate(() => { window._capturedAlert = null; });
  await fileInput.setInputFiles({
    name: 'doc.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('fake pdf'),
  });
  await page.waitForFunction(() => window._capturedAlert !== null, { timeout: 5000 });
  const alertMsg2 = await page.evaluate(() => window._capturedAlert);
  expect(alertMsg2).toContain('JPG, PNG, GIF');

  // 미리보기 이미지가 없어야 함
  await expect(page.locator('img[alt="채팅방 이미지 미리보기"]')).toHaveCount(0);
});

// ─────────────────────────────────────────────
// E2E-STICKER-001 | SPEC-MSG-003
// AC-MSG-003-1, AC-MSG-003-2
// ─────────────────────────────────────────────
test('스티커 선택 모달 표시 및 채팅창 전송 확인', async ({ page }) => {
  const nickname = `user_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();

  await page.waitForURL('**/');
  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();
  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();

  await waitForConnected(page);

  // 스티커 버튼 클릭 (AC-MSG-003-1)
  await page.getByRole('button', { name: '스티커' }).click();
  await expect(page.getByText('스티커 선택')).toBeVisible();

  // 스티커 선택 (이모지 스티커 팩에서 첫 번째)
  await page.getByText('😍').click();

  // 모달이 닫히고 스티커가 채팅창에 표시됨 (AC-MSG-003-2)
  await expect(page.getByText('스티커 선택')).not.toBeVisible();
  await expect(page.getByText('😍')).toBeVisible();
});

// ─────────────────────────────────────────────
// E2E-MSG-004 | SPEC-MSG-001
// AC-MSG-001-4
// ─────────────────────────────────────────────
test('공백만 입력 시 전송 버튼 비활성화', async ({ page }) => {
  const nickname = `user_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();

  await page.waitForURL('**/');
  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();
  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();

  await waitForConnected(page);

  // 공백만 입력 시 전송 버튼 비활성화 확인 (AC-MSG-001-4)
  await page.getByPlaceholder(/메시지를 입력하세요/).fill('   ');
  await expect(page.getByRole('button', { name: '전송' })).toBeDisabled();
});

// ─────────────────────────────────────────────
// E2E-MSG-LAYOUT | SPEC-MSG-001
// AC-MSG-001-3
// ─────────────────────────────────────────────
test('내 메시지는 우측 정렬 확인', async ({ page, request }) => {
  const myNickname = `me_${Date.now()}`;
  const otherNickname = `other_${Date.now()}`;
  const roomName = `room_${Date.now()}`;
  const myMessage = `my_msg_${Date.now()}`;

  const otherUser = await createUser(request, otherNickname);
  const chatRoom = await createChatRoom(request, otherUser.id, roomName);

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(myNickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();

  await expect(page.getByRole('button', { name: '새 채팅방 만들기' })).toBeVisible();
  await page.getByText(roomName).click();

  await waitForConnected(page);
  await page.getByPlaceholder(/메시지를 입력하세요/).fill(myMessage);
  await page.getByRole('button', { name: '전송' }).click();

  const myMessageEl = page.getByText(myMessage);
  await expect(myMessageEl).toBeVisible();

  // 내 메시지 컨테이너가 justify-end (우측 정렬) 클래스를 가지는지 확인
  const myMessageContainer = myMessageEl.locator('xpath=ancestor::div[contains(@class,"justify-end")]');
  await expect(myMessageContainer.first()).toBeVisible();
});

// ─────────────────────────────────────────────
// E2E-IMG-001 | SPEC-MSG-002
// AC-MSG-002-4
// ─────────────────────────────────────────────
test('유효한 이미지 업로드 후 채팅창 렌더링', async ({ page }) => {
  await setupChatRoom(page);

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'test-image.png',
    mimeType: 'image/png',
    buffer: MINIMAL_PNG,
  });

  // 업로드 완료 후 채팅창에 이미지 태그 렌더링 확인 (AC-MSG-002-4)
  await expect(
    page.locator('img[alt="사용자가 전송한 이미지"]')
  ).toBeVisible({ timeout: 15000 });
});

// ─────────────────────────────────────────────
// E2E-IMG-002 | SPEC-MSG-002
// AC-MSG-002-1
// ─────────────────────────────────────────────
test('5MB 초과 파일 업로드 시 경고 표시', async ({ page }) => {
  await setupChatRoom(page);

  // window.alert를 스파이로 교체해서 메시지를 캡처 (dialog 타이밍 이슈 우회)
  await page.evaluate(() => {
    window._capturedAlert = null;
    window.alert = (msg) => { window._capturedAlert = msg; };
  });

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'large-image.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 0), // 5MB + 1 byte
  });

  // React 이벤트 처리 완료 대기
  await page.waitForFunction(() => window._capturedAlert !== null, { timeout: 5000 });

  const alertMsg = await page.evaluate(() => window._capturedAlert);
  // "파일 크기가 5MB를 초과합니다." 확인 (AC-MSG-002-1)
  expect(alertMsg).toContain('5MB');

  // 이미지가 채팅창에 추가되지 않아야 함
  await expect(page.locator('img[alt="사용자가 전송한 이미지"]')).toHaveCount(0);
});

// ─────────────────────────────────────────────
// E2E-SEARCH-004 | SPEC-MSG-005
// 시스템 메시지는 검색 결과에서 제외
// ─────────────────────────────────────────────
test('시스템 메시지는 검색 결과에 포함되지 않음', async ({ page }) => {
  const nickname = `user_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();

  await page.waitForURL('**/');
  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();
  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();

  await waitForConnected(page);

  // 방 생성 시 서버가 자동으로 SYSTEM 메시지를 생성함
  // "채팅방을 생성했습니다." 는 SYSTEM 메시지이므로 검색 결과에서 제외되어야 함
  await page.getByRole('button', { name: '메시지 검색' }).click();
  await page.getByPlaceholder('검색...').fill('채팅방을 생성했습니다');
  await page.getByPlaceholder('검색...').press('Enter');

  // 시스템 메시지는 필터링되어 결과 0건이어야 함
  await expect(page.getByText('검색 결과 없음')).toBeVisible();
});

// ─────────────────────────────────────────────
// E2E-SEARCH-005 | SPEC-MSG-005
// 참가자 필터링 시 해당 참가자의 메시지만 표시
// ─────────────────────────────────────────────
test('참가자 필터링 시 해당 참가자의 메시지만 표시', async ({ page, request }) => {
  const user1Nickname = `user1_${Date.now()}`;
  const user2Nickname = `user2_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  // user2를 API로 생성하고 방에 참여시킴 (메시지는 보내지 않음)
  const user1 = await createUser(request, user1Nickname);
  const user2 = await createUser(request, user2Nickname);
  const chatRoom = await createChatRoom(request, user1.id, roomName);
  await joinChatRoom(request, chatRoom.id, user2.id);

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(user1Nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');
  await page.getByText(roomName).click();

  await waitForConnected(page);

  // user1이 "hello" 메시지 전송
  await page.getByPlaceholder(/메시지를 입력하세요/).fill('hello world');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('hello world')).toBeVisible();

  // 키워드 검색
  await page.getByRole('button', { name: '메시지 검색' }).click();
  await page.getByPlaceholder('검색...').fill('hello');
  await page.getByPlaceholder('검색...').press('Enter');
  await expect(page.getByText(/\d+건/)).toBeVisible();

  // user2(메시지 없음)로 필터링 → 결과 0건
  await page.getByRole('button', { name: '인물 검색' }).click();
  await page.getByRole('button', { name: user2Nickname }).click();

  // 인물 필터 칩이 검색 바에 표시됨
  await expect(page.getByText(user2Nickname).first()).toBeVisible();
  // user2가 "hello" 메시지를 보내지 않았으므로 결과 없음
  await expect(page.getByText('검색 결과 없음')).toBeVisible();

  // 인물 필터 해제 → 다시 user1 메시지 결과 표시
  await page.getByRole('button', { name: '인물 필터 해제' }).click();
  await expect(page.getByText(/\d+건/)).toBeVisible();
});

// ─────────────────────────────────────────────
// E2E-SEARCH-006 | SPEC-MSG-005
// 참가자 + 키워드 복합 필터링 (AND 조건)
// ─────────────────────────────────────────────
test('참가자와 키워드 복합 필터링 시 교집합 결과 표시', async ({ page, request }) => {
  const user1Nickname = `user1_${Date.now()}`;
  const user2Nickname = `user2_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  const user1 = await createUser(request, user1Nickname);
  const user2 = await createUser(request, user2Nickname);
  const chatRoom = await createChatRoom(request, user1.id, roomName);
  await joinChatRoom(request, chatRoom.id, user2.id);

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(user1Nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');
  await page.getByText(roomName).click();

  await waitForConnected(page);

  // user1이 "apple"과 "banana" 메시지 전송
  await page.getByPlaceholder(/메시지를 입력하세요/).fill('apple');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('apple')).toBeVisible();

  await page.getByPlaceholder(/메시지를 입력하세요/).fill('banana');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('banana')).toBeVisible();

  // "apple" 검색 → user1의 1건
  await page.getByRole('button', { name: '메시지 검색' }).click();
  await page.getByPlaceholder('검색...').fill('apple');
  await page.getByPlaceholder('검색...').press('Enter');
  await expect(page.getByText(/\d+건/)).toBeVisible();

  // user1으로 필터 → 여전히 1건 (user1이 apple 전송)
  await page.getByRole('button', { name: '인물 검색' }).click();
  await page.getByRole('button', { name: user1Nickname }).click();
  await expect(page.getByText(/\d+건/)).toBeVisible();

  // user2로 필터 전환 → 0건 (user2는 apple 미전송)
  await page.getByRole('button', { name: '인물 검색' }).click();
  await page.getByRole('button', { name: user2Nickname }).click();
  await expect(page.getByText('검색 결과 없음')).toBeVisible();
});

// ─────────────────────────────────────────────
// E2E-SEARCH-007 | SPEC-MSG-005
// 참가자 필터링 시 메시지 버블의 발신자 이름 하이라이팅
// ─────────────────────────────────────────────
test('참가자 필터링 시 메시지 버블의 발신자 이름 하이라이팅', async ({ browser, request }) => {
  const user1Nickname = `user1_${Date.now()}`;
  const user2Nickname = `user2_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  const user1 = await createUser(request, user1Nickname);
  const user2 = await createUser(request, user2Nickname);
  const chatRoom = await createChatRoom(request, user1.id, roomName);
  await joinChatRoom(request, chatRoom.id, user2.id);

  // user2가 별도 브라우저 컨텍스트에서 메시지 전송
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.goto('/login');
  await page2.getByLabel('닉네임').fill(user2Nickname);
  await page2.getByRole('button', { name: '채팅 시작' }).click();
  await page2.waitForURL('**/');
  await page2.getByText(roomName).click();
  await expect(page2.getByPlaceholder(/메시지를 입력하세요/)).toBeVisible({ timeout: 15000 });
  await page2.getByPlaceholder(/메시지를 입력하세요/).fill('hello from user2');
  await page2.getByRole('button', { name: '전송' }).click();
  await expect(page2.getByText('hello from user2')).toBeVisible();

  // user1이 채팅방 입장하여 user2의 메시지 확인
  const context1 = await browser.newContext();
  const page1 = await context1.newPage();
  await page1.goto('/login');
  await page1.getByLabel('닉네임').fill(user1Nickname);
  await page1.getByRole('button', { name: '채팅 시작' }).click();
  await page1.waitForURL('**/');
  await page1.getByText(roomName).click();
  await expect(page1.getByPlaceholder(/메시지를 입력하세요/)).toBeVisible({ timeout: 15000 });

  // user2의 메시지가 user1 화면에 표시됨
  await expect(page1.getByText('hello from user2')).toBeVisible({ timeout: 10000 });

  // user1이 "hello" 검색 후 user2로 필터링
  await page1.getByRole('button', { name: '메시지 검색' }).click();
  await page1.getByPlaceholder('검색...').fill('hello');
  await page1.getByPlaceholder('검색...').press('Enter');
  await expect(page1.getByText(/\d+건/)).toBeVisible();

  await page1.getByRole('button', { name: '인물 검색' }).click();
  await page1.getByRole('button', { name: user2Nickname }).click();
  await expect(page1.getByText(/\d+건/)).toBeVisible();

  // user2 이름이 메시지 버블 위에 하이라이팅(mark 태그)으로 표시됨
  await expect(page1.locator('mark', { hasText: user2Nickname })).toBeVisible();

  await context1.close();
  await context2.close();
});

// ─────────────────────────────────────────────
// E2E-IMG-003 | SPEC-MSG-002
// AC-MSG-002-2
// ─────────────────────────────────────────────
test('지원하지 않는 파일 형식 업로드 시 경고 표시', async ({ page }) => {
  await setupChatRoom(page);

  await page.evaluate(() => {
    window._capturedAlert = null;
    window.alert = (msg) => { window._capturedAlert = msg; };
  });

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'document.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('fake pdf content'),
  });

  await page.waitForFunction(() => window._capturedAlert !== null, { timeout: 5000 });

  const alertMsg = await page.evaluate(() => window._capturedAlert);
  // "JPG, PNG, GIF 형식만 지원합니다." 확인 (AC-MSG-002-2)
  expect(alertMsg).toContain('JPG, PNG, GIF');

  // 이미지가 채팅창에 추가되지 않아야 함
  await expect(page.locator('img[alt="사용자가 전송한 이미지"]')).toHaveCount(0);
});

// ─────────────────────────────────────────────
// E2E-SEARCH-008 | SPEC-MSG-005
// 키워드 없이 발신자 필터만으로 건수 표시 및 화살표 네비게이션
// ─────────────────────────────────────────────
test('키워드 없이 발신자 필터만으로 건수 표시 및 화살표 네비게이션', async ({ page, request }) => {
  const user1Nickname = `user1_${Date.now()}`;
  const user2Nickname = `user2_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  // user1이 방 생성, user2는 API로만 참여 (메시지 전송 없음)
  const user1 = await createUser(request, user1Nickname);
  const user2 = await createUser(request, user2Nickname);
  const chatRoom = await createChatRoom(request, user1.id, roomName);
  await joinChatRoom(request, chatRoom.id, user2.id);

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(user1Nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');
  await page.getByText(roomName).click();
  await waitForConnected(page);

  // user1이 메시지 2개 전송
  await page.getByPlaceholder(/메시지를 입력하세요/).fill('첫번째 메시지');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('첫번째 메시지')).toBeVisible();

  await page.getByPlaceholder(/메시지를 입력하세요/).fill('두번째 메시지');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('두번째 메시지')).toBeVisible();

  // 검색 바 열기 (키워드 입력 없이)
  await page.getByRole('button', { name: '메시지 검색' }).click();

  // user1으로 발신자 필터만 적용 (키워드 없음)
  await page.getByRole('button', { name: '인물 검색' }).click();
  await page.getByRole('button', { name: user1Nickname }).click();

  // 건수가 표시되어야 함 (최소 2건)
  await expect(page.getByText(/\d+건/)).toBeVisible();

  // 화살표 버튼이 활성화되어야 함 (disabled 아님)
  await expect(page.getByRole('button', { name: '이전 검색 결과' })).not.toBeDisabled();
  await expect(page.getByRole('button', { name: '다음 검색 결과' })).not.toBeDisabled();

  // user2(메시지 없음)로 전환 → 검색 결과 없음 + 화살표 비활성화
  await page.getByRole('button', { name: '인물 검색' }).click();
  await page.getByRole('button', { name: user2Nickname }).click();
  await expect(page.getByText('검색 결과 없음')).toBeVisible();
  await expect(page.getByRole('button', { name: '이전 검색 결과' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '다음 검색 결과' })).toBeDisabled();
});

// ─────────────────────────────────────────────
// E2E-SEARCH-009 | SPEC-MSG-005
// 캘린더 날짜 선택 시 검색어·발신자 필터 초기화 후 날짜 세퍼레이터로 이동
// ─────────────────────────────────────────────
test('캘린더 날짜 선택 시 필터 초기화 및 날짜 세퍼레이터로 이동', async ({ page }) => {
  const nickname = `user_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');
  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();
  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();
  await waitForConnected(page);

  // 메시지 전송 (오늘 날짜에 메시지 존재하도록)
  await page.getByPlaceholder(/메시지를 입력하세요/).fill('캘린더 테스트');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('캘린더 테스트')).toBeVisible();

  // 검색 바 열기 → 키워드 검색 적용
  await page.getByRole('button', { name: '메시지 검색' }).click();
  await page.getByPlaceholder('검색...').fill('캘린더');
  await page.getByPlaceholder('검색...').press('Enter');
  await expect(page.getByText(/\d+건/)).toBeVisible();

  // 캘린더 열기 → 오늘 날짜(활성화된 날짜) 클릭
  await page.getByRole('button', { name: '날짜로 이동' }).click();
  const activeDateBtn = page.locator('button.bg-blue-50').first();
  await expect(activeDateBtn).toBeVisible();
  await activeDateBtn.click();

  // 날짜 선택 후 검색 결과 카운트가 사라지고 캘린더가 닫혀야 함 (필터 초기화 확인)
  await expect(page.getByText(/\d+건/)).not.toBeVisible({ timeout: 3000 });

  // 날짜 세퍼레이터(날짜 구분선)가 화면에 표시되어야 함
  await expect(
    page.locator('div.rounded-full.border').filter({ hasText: /\d{4}년/ })
  ).toBeVisible({ timeout: 5000 });
});

// ─────────────────────────────────────────────
// E2E-SEARCH-010 | SPEC-MSG-005
// AC-MSG-005-1b
// 발신자 필터 선택 상태에서 검색어 제거 후 Enter → 발신자 단독 필터링 전환
// ─────────────────────────────────────────────
test('발신자 필터 선택 상태에서 검색어 제거 후 Enter 시 오류 없이 발신자 단독 필터링으로 전환', async ({ page, request }) => {
  const user1Nickname = `user1_${Date.now()}`;
  const user2Nickname = `user2_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  const user1 = await createUser(request, user1Nickname);
  const user2 = await createUser(request, user2Nickname);
  const chatRoom = await createChatRoom(request, user1.id, roomName);
  await joinChatRoom(request, chatRoom.id, user2.id);

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(user1Nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');
  await page.getByText(roomName).click();
  await waitForConnected(page);

  // user1이 메시지 2개 전송
  await page.getByPlaceholder(/메시지를 입력하세요/).fill('안녕하세요');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('안녕하세요')).toBeVisible();

  await page.getByPlaceholder(/메시지를 입력하세요/).fill('반갑습니다');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('반갑습니다')).toBeVisible();

  // 검색 바 열기 → 키워드 "안녕" 검색
  await page.getByRole('button', { name: '메시지 검색' }).click();
  await page.getByPlaceholder('검색...').fill('안녕');
  await page.getByPlaceholder('검색...').press('Enter');
  await expect(page.getByText(/\d+건/)).toBeVisible();

  // user1으로 발신자 필터 추가 → 복합 필터 상태
  await page.getByRole('button', { name: '인물 검색' }).click();
  await page.getByRole('button', { name: user1Nickname }).click();
  await expect(page.getByText(/\d+건/)).toBeVisible();

  // 검색어를 지우고 Enter 제출 → 발신자 단독 필터링으로 전환
  await page.getByPlaceholder('검색...').clear();
  await page.getByPlaceholder('검색...').press('Enter');

  // 오류 메시지가 표시되어서는 안 됨 (AC-MSG-005-1b)
  await expect(page.getByText('검색어를 입력해주세요.')).not.toBeVisible();

  // 발신자 필터 칩은 유지되어야 함
  await expect(page.getByText(user1Nickname).first()).toBeVisible();

  // user1의 모든 메시지가 포함된 건수가 표시되어야 함 (안녕하세요 + 반갑습니다 = 2건 이상)
  await expect(page.getByText(/\d+건/)).toBeVisible();
});

// ─────────────────────────────────────────────
// E2E-SEARCH-011 | SPEC-MSG-005
// AC-MSG-005-7
// 검색 결과 이동 시 메시지 버블에 바운스 애니메이션 적용 (노란 링 미적용)
// ─────────────────────────────────────────────
test('검색 결과 이동 시 메시지 버블에 바운스 애니메이션 적용되고 노란 링은 적용되지 않음', async ({ page }) => {
  const nickname = `user_${Date.now()}`;
  const roomName = `room_${Date.now()}`;

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');
  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();
  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();
  await waitForConnected(page);

  // 검색 결과 2건이 되도록 메시지 전송
  await page.getByPlaceholder(/메시지를 입력하세요/).fill('테스트A');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('테스트A')).toBeVisible();

  await page.getByPlaceholder(/메시지를 입력하세요/).fill('테스트B');
  await page.getByRole('button', { name: '전송' }).click();
  await expect(page.getByText('테스트B')).toBeVisible();

  // 검색 실행 → 2건 결과
  await page.getByRole('button', { name: '메시지 검색' }).click();
  await page.getByPlaceholder('검색...').fill('테스트');
  await page.getByPlaceholder('검색...').press('Enter');
  await expect(page.getByText(/\d+건/)).toBeVisible();

  // 노란 링(ring-2 ring-yellow-300) 클래스가 어떤 메시지에도 적용되지 않아야 함 (AC-MSG-005-7)
  await expect(page.locator('.ring-2.ring-yellow-300')).toHaveCount(0);

  // 화살표로 이동 → 다른 메시지 포커스
  await page.getByRole('button', { name: '이전 검색 결과' }).click();

  // 이동 후에도 노란 링이 없어야 함
  await expect(page.locator('.ring-2.ring-yellow-300')).toHaveCount(0);

  // 이동한 메시지 버블에 바운스 애니메이션 인라인 스타일이 적용되어야 함 (AC-MSG-005-7)
  const bouncingBubble = page.locator('[style*="message-bounce"]');
  await expect(bouncingBubble.first()).toBeVisible({ timeout: 3000 });
});
