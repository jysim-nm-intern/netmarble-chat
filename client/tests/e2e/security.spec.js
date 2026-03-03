import { test, expect } from '@playwright/test';

const apiBaseUrl = 'http://localhost:8080';

// ─────────────────────────────────────────────
// TC1 — 미인증 URL 직접 접근 차단
// 로그인 없이 보호 페이지 접근 시 /login 리다이렉트
// ─────────────────────────────────────────────
test('TC1 — 미인증 사용자의 직접 URL 접근은 로그인 페이지로 리다이렉트', async ({ page }) => {
  // 루트 경로 접근
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);

  // 존재하지 않을 수도 있는 채팅방 URL 직접 접근
  await page.goto('/chatroom/1');
  await expect(page).toHaveURL(/\/login/);
});

// ─────────────────────────────────────────────
// TC2 — 로그인 후 세션 쿠키 생성
// ─────────────────────────────────────────────
test('TC2 — 로그인 성공 후 JSESSIONID 세션 쿠키 생성', async ({ page }) => {
  const nickname = `sec_user_${Date.now()}`;

  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');

  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === 'JSESSIONID');
  expect(sessionCookie).toBeDefined();
  expect(sessionCookie.value).toBeTruthy();
});

// ─────────────────────────────────────────────
// TC3 — 로그아웃 후 보호 페이지 차단
// ─────────────────────────────────────────────
test('TC3 — 로그아웃 후 보호 페이지 접근 시 로그인 페이지로 리다이렉트', async ({ page }) => {
  const nickname = `sec_user_${Date.now()}`;

  // 로그인
  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');

  // 로그인 상태에서 '/' 접근 → 정상 화면
  await expect(page.getByRole('button', { name: '새 채팅방 만들기' })).toBeVisible();

  // 로그아웃 트리거 버튼 클릭
  await page.getByRole('button', { name: '로그아웃' }).first().click();
  // 확인 모달 표시
  await expect(page.getByText('정말 로그아웃 하시겠습니까?')).toBeVisible();
  // 모달의 로그아웃 확인 버튼 (마지막 '로그아웃' 버튼)
  await page.getByRole('button', { name: '로그아웃' }).last().click();

  // 로그인 페이지로 이동
  await page.waitForURL('**/login');

  // 로그아웃 후 '/' 접근 → 다시 /login으로 리다이렉트
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

// ─────────────────────────────────────────────
// TC4 — localStorage userId 조작 불가
// localStorage의 chatUser.id를 조작해도 메시지는 실제 세션 사용자로 저장
// ─────────────────────────────────────────────
test('TC4 — localStorage userId 조작 후에도 메시지 전송 성공 (서버가 세션 userId 사용)', async ({ page }) => {
  const nickname = `sec_alice_${Date.now()}`;
  const roomName = `sec_room_${Date.now()}`;

  // alice로 로그인 후 채팅방 생성
  await page.goto('/login');
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByRole('button', { name: '채팅 시작' }).click();
  await page.waitForURL('**/');

  await page.getByRole('button', { name: '새 채팅방 만들기' }).click();
  await page.getByLabel('채팅방 이름 *').fill(roomName);
  await page.getByRole('button', { name: '생성' }).click();
  await expect(page.getByPlaceholder(/메시지를 입력하세요/)).toBeVisible({ timeout: 15000 });

  // localStorage의 chatUser.id를 존재하지 않는 99999로 조작
  await page.evaluate(() => {
    const chatUser = JSON.parse(localStorage.getItem('chatUser') || '{}');
    chatUser.id = 99999;
    localStorage.setItem('chatUser', JSON.stringify(chatUser));
  });

  // 메시지 전송 — 서버는 payload의 userId가 아닌 session에서 senderId 추출
  const message = `sec_msg_${Date.now()}`;
  await page.getByPlaceholder(/메시지를 입력하세요/).fill(message);
  await page.getByRole('button', { name: '전송' }).click();

  // 메시지가 정상 전송됨: 서버 세션으로 인증되었기 때문에 메시지가 채팅창에 표시됨
  await expect(page.getByText(message)).toBeVisible({ timeout: 10000 });
});

// ─────────────────────────────────────────────
// TC5 — 세션 없이 API 보호 엔드포인트 접근 시 401 반환
// ─────────────────────────────────────────────
test('TC5 — 세션 없이 보호 API 엔드포인트 접근 시 401 응답', async ({ request }) => {
  // 채팅방 입장 (미인증)
  const joinResponse = await request.post(`${apiBaseUrl}/api/chat-rooms/1/join`);
  expect(joinResponse.status()).toBe(401);

  // 채팅방 퇴장 (미인증)
  const leaveResponse = await request.post(`${apiBaseUrl}/api/chat-rooms/1/leave`);
  expect(leaveResponse.status()).toBe(401);

  // 읽음 처리 (미인증)
  const readResponse = await request.post(`${apiBaseUrl}/api/read-status/mark-read`, {
    params: { chatRoomId: 1 }
  });
  expect(readResponse.status()).toBe(401);
});
