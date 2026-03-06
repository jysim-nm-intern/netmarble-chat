# 05. 인터페이스 명세 (Interface Specifications)

← [목차로 돌아가기](../sdd-specification.md)

---

## 공통 규칙

- **chat-server Base URL:** `http://localhost:8080/api` (유저, 채팅방, 검색, 파일 업로드)
- **api-server Base URL:** `http://localhost:8081/api` (메시지 이력 조회)
- **WebSocket 엔드포인트:** `http://localhost:8080/ws-stomp` (chat-server)
- **Content-Type:** `application/json` (파일 업로드는 `multipart/form-data`)
- **문자 인코딩:** UTF-8

### 공통 응답 형식 (ApiResponse Wrapper)

모든 REST 응답은 아래 형식을 따른다.

```json
// 성공 (2xx)
{
  "success": true,
  "data": { /* 실제 데이터 */ },
  "error": null
}

// 실패 (4xx, 5xx)
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자 친화적 오류 메시지"
  }
}
```

### 정의된 오류 코드

| 코드 | HTTP 상태 | 설명 |
|------|-----------|------|
| `USER_NOT_FOUND` | 404 | 사용자를 찾을 수 없음 |
| `ROOM_NOT_FOUND` | 404 | 채팅방을 찾을 수 없음 |
| `ROOM_NOT_ACTIVE` | 400 | 비활성화된 채팅방 |
| `INVALID_NICKNAME` | 400 | 닉네임 형식 오류 |
| `INVALID_ROOM_NAME` | 400 | 채팅방 이름 형식 오류 |
| `FILE_TOO_LARGE` | 400 | 파일 크기 초과 (5MB) |
| `UNSUPPORTED_FILE_TYPE` | 400 | 지원하지 않는 파일 형식 |
| `UNAUTHORIZED` | 401 | 인증 토큰 없음 또는 만료 |
| `TOKEN_BLACKLISTED` | 401 | 로그아웃된 토큰 사용 |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh Token 유효하지 않음 |

### 인증 헤더 (Phase 2 — JWT)

> Phase 2부터 모든 보호된 API는 `Authorization` 헤더에 Bearer 토큰을 필요로 합니다.

```
Authorization: Bearer <AccessToken>
```

| 항목 | 값 |
|------|----|
| 알고리즘 | HS256 |
| AccessToken 만료 | 15분 |
| RefreshToken 만료 | 7일 |
| 토큰 저장소 | Redis (RefreshToken), Redis 블랙리스트 (로그아웃된 AccessToken) |

#### JWT Payload 구조

```json
{
  "sub":  "1",
  "nickname": "홍길동",
  "jti": "uuid-v4",
  "iat": 1700000000,
  "exp": 1700000900
}
```

#### WebSocket 인증 (STOMP Handshake)

STOMP 연결 시 첫 번째 프레임 헤더에 토큰을 포함합니다.

```
CONNECT
Authorization: Bearer <AccessToken>
```

---

## REST API 명세

### 사용자 API

#### POST /api/users — 로그인 / 사용자 생성

| 항목 | 내용 |
|------|------|
| **Content-Type** | `multipart/form-data` |
| **요청 파라미터** | `nickname` (String, 필수) · `profileColor` (String, 선택) · `image` (MultipartFile, 선택, JPG/PNG/GIF, 최대 5MB) |
| **성공 응답** | `201 Created` · `{ "userId": 1, "nickname": "string", "profileColor": "#hex", "profileImage": "data:image/...;base64,..." }` |
| **실패 응답** | `400` · `INVALID_NICKNAME` (형식 오류) |
| **비즈니스 규칙** | 닉네임 중복 시 기존 사용자 반환하되 profileColor·profileImage 갱신 |

#### GET /api/users/{userId} — 사용자 조회

| 항목 | 내용 |
|------|------|
| **Path 파라미터** | `userId: Long` |
| **성공 응답** | `200 OK` · `{ "userId": 1, "nickname": "string" }` |
| **실패 응답** | `404` · `USER_NOT_FOUND` |

---

### 채팅방 API

#### GET /api/chat-rooms — 채팅방 목록 조회

| 항목 | 내용 |
|------|------|
| **Query 파라미터** | `userId: Long` (미읽음 카운트 계산 기준) |
| **성공 응답** | `200 OK` · 아래 배열 |

```json
[
  {
    "roomId": 1,
    "name": "채팅방 이름",
    "imageUrl": "data:image/png;base64,...",
    "isActive": true,
    "memberCount": 3,
    "creatorNickname": "닉네임",
    "isMember": true,
    "lastMessageContent": "마지막 메시지 미리보기",
    "lastMessageAt": "2026-02-24T10:36:00",
    "createdAt": "2026-02-23T10:00:00",
    "unreadCount": 3
  }
]
```

> **필드 설명**
> - `isMember`: 요청한 `userId`가 해당 채팅방의 활성 참여자이면 `true`
> - `imageUrl`: 채팅방 썸네일 이미지 (Base64 인코딩 Data URL, 없으면 `null`)
> - `lastMessageContent`: 가장 최근 메시지 내용 (없으면 `null`)
> - `lastMessageAt`: 가장 최근 메시지 시각 (없으면 `createdAt`)
> - `unreadCount`: `isMember`가 `true`인 경우에만 계산, 비참여자는 `0`

#### POST /api/chat-rooms — 채팅방 생성

| 항목 | 내용 |
|------|------|
| **Content-Type** | `multipart/form-data` |
| **요청 파라미터** | `name` (String, 필수, 2자 이상) · `creatorId` (Long, 필수) · `image` (MultipartFile, 선택, JPG/PNG/GIF, 최대 5MB) |
| **성공 응답** | `201 Created` · `{ "roomId": 1, "name": "string", "imageUrl": "data:image/png;base64,...", "isActive": true, "createdAt": "..." }` |
| **실패 응답** | `400` · `INVALID_ROOM_NAME` |
| **부수 효과** | SYSTEM 메시지 생성 + WebSocket 브로드캐스트 |

#### POST /api/chat-rooms/{roomId}/join — 채팅방 입장

| 항목 | 내용 |
|------|------|
| **Path 파라미터** | `roomId: Long` |
| **요청 Body** | `{ "userId": 1 }` |
| **성공 응답** | `200 OK` · 아래 |
| **실패 응답** | `404` · `ROOM_NOT_FOUND` |
| **부수 효과** | SYSTEM 메시지 생성 + WebSocket 브로드캐스트 |

```json
{
  "participantId": 1,
  "recentMessages": [
    {
      "messageId": 100,
      "userId": 2,
      "nickname": "닉네임",
      "messageType": "TEXT",
      "content": "메시지 내용",
      "attachmentUrl": null,
      "unreadCount": 0,
      "createdAt": "..."
    }
  ]
}
```

#### DELETE /api/chat-rooms/{roomId}/leave — 채팅방 퇴장

| 항목 | 내용 |
|------|------|
| **Path 파라미터** | `roomId: Long` |
| **요청 Body** | `{ "userId": 1 }` |
| **성공 응답** | `200 OK` · `{ "success": true }` |
| **부수 효과** | participant.left_at 기록 + SYSTEM 메시지 브로드캐스트 |

#### GET /api/chat-rooms/{roomId}/members — 활성 멤버 목록

| 항목 | 내용 |
|------|------|
| **성공 응답** | `200 OK` · `[{ "userId": 1, "nickname": "string" }]` |

---

### 메시지 API

#### GET /api/rooms/{roomId}/messages — 메시지 이력 조회

| 항목 | 내용 |
|------|------|
| **Query 파라미터** | `cursor: Long` (선택), `limit: Int` (기본 50) |
| **성공 응답** | `200 OK` · `{ "messages": [...], "nextCursor": 100 }` |

#### GET /api/chat-rooms/{roomId}/messages/search — 메시지 검색

| 항목 | 내용 |
|------|------|
| **Query 파라미터** | `keyword: string` (1자 이상, 255자 이하) |
| **성공 응답** | `200 OK` · MessageResponse 배열 (최신순 정렬) |

#### POST /api/messages/attachments — 이미지 업로드

| 항목 | 내용 |
|------|------|
| **Content-Type** | `multipart/form-data` |
| **요청** | 파일 필드: JPG/PNG/GIF, 최대 5MB |
| **성공 응답** | `200 OK` · `{ "fileUrl": "http://...", "fileType": "IMAGE" }` |
| **실패 응답** | `400` · `FILE_TOO_LARGE` 또는 `UNSUPPORTED_FILE_TYPE` |

---

## WebSocket / STOMP 명세

### 연결 설정

| 항목 | 값 |
|------|-----|
| **엔드포인트** | `http://localhost:8080/ws-stomp` |
| **Fallback** | SockJS 지원 |
| **브로커** | 인메모리 STOMP 브로커 (기본) / RabbitMQ (scale 모드) |
| **구독 prefix** | `/topic` |
| **발행 prefix** | `/app` |

### 연결 수명주기

WebSocket 연결은 **로그인 직후 한 번** 수립하며, **로그아웃 또는 페이지 종료 시에만** 해제한다.
채팅방 목록 ↔ 채팅방 내부 간 이동 시에도 연결을 유지하여, 채팅방 목록에서도 실시간 이벤트를 수신할 수 있다.

```
[로그인 성공]
     ↓
 WebSocket 연결 수립 (ChatRoom 컴포넌트 마운트 시)
     ↓
 ┌──────────────────────────────────────────┐
 │  채팅방 목록 화면                          │
 │  → 참가중 채팅방 토픽 구독                  │
 │    /topic/chatroom.{id} × N개             │
 │  → 실시간 lastMessage·unreadCount 갱신     │
 └──────────────┬───────────────────────────┘
                │ (채팅방 입장)
                ↓
 ┌──────────────────────────────────────────┐
 │  채팅방 내부 화면                          │
 │  → 해당 방 메시지·읽음 상태 토픽 구독        │
 │    /topic/chatroom.{id}                   │
 │    /topic/chatroom.{id}.read-status       │
 └──────────────┬───────────────────────────┘
                │ (목록으로 돌아감)
                ↓
 ┌──────────────────────────────────────────┐
 │  채팅방 목록 화면 (WebSocket 연결 유지)     │
 │  → REST API로 최신 데이터 다시 로드          │
 │  → 참가중 채팅방 토픽 재구독                 │
 └──────────────────────────────────────────┘
                │ (로그아웃)
                ↓
 WebSocket 연결 해제
```

> **주의:** 활성 상태 추적(`useActivityTracking`)의 비활성 전환 시에도 WebSocket 연결은 유지된다.
> 비활성 시에는 해당 채팅방의 구독만 해제하고, 전체 연결은 끊지 않는다.

---

### 구독 경로 (서버 → 클라이언트)

#### /topic/chatroom.{roomId}

채팅방의 실시간 이벤트를 수신한다. **채팅방 내부**에서는 메시지 렌더링에, **채팅방 목록**에서는 마지막 메시지 및 미읽음 수 갱신에 사용된다. 수신 데이터는 이벤트 유형에 따라 두 가지 형태이다.

**① 새 메시지 수신:**
```json
{
  "messageId": 50,
  "userId": 1,
  "nickname": "발신자명",
  "messageType": "TEXT | IMAGE | STICKER | SYSTEM",
  "content": "메시지 내용",
  "attachmentUrl": null,
  "unreadCount": 2,
  "createdAt": "2026-02-23T10:00:00"
}
```

**② 읽음 상태 갱신 이벤트:**
```json
{
  "type": "READ_STATUS_UPDATE",
  "roomId": 1,
  "userId": 1,
  "lastReadMessageId": 150
}
```

> **채팅방 목록에서의 구독 활용:**
> `ChatRoomList` 컴포넌트는 참가중인 모든 채팅방의 `/topic/chatroom.{roomId}`를 구독하여,
> 새 메시지(①) 수신 시 해당 방의 `lastMessageContent`, `lastMessageAt`, `unreadCount`를 로컬에서 갱신한다.
> 이를 통해 페이지 새로고침 없이 채팅방 목록이 실시간으로 업데이트된다.

#### /topic/chatroom.{roomId}.read-status

채팅방 내 읽음 상태 업데이트를 수신한다. `ChatRoomView`에서만 구독하며, 메시지별 `unreadCount` 재계산에 사용된다.

---

### 발행 경로 (클라이언트 → 서버)

#### /app/chat.message — 메시지 전송

```json
{
  "roomId": 1,
  "userId": 1,
  "messageType": "TEXT | IMAGE | STICKER",
  "content": "메시지 내용",
  "attachmentUrl": null
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `roomId` | Long | O | 대상 채팅방 ID |
| `userId` | Long | O | 발신자 ID |
| `messageType` | String | O | `TEXT` / `IMAGE` / `STICKER` |
| `content` | String | O | 메시지 본문 |
| `attachmentUrl` | String | X | 이미지 URL 또는 스티커 ID (TEXT이면 null) |

#### /app/chat.read — 읽음 처리

```json
{
  "roomId": 1,
  "userId": 1,
  "lastReadMessageId": 150
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `roomId` | Long | O | 대상 채팅방 ID |
| `userId` | Long | O | 읽음 처리 주체 사용자 ID |
| `lastReadMessageId` | Long | O | 마지막으로 읽은 메시지 ID |

---

## Phase 2 추가 API (SPEC-API-010 ~ 012)

### SPEC-API-010 — JWT 인증 엔드포인트

#### POST /api/auth/login — 로그인 (토큰 발급)

**요청:**
```json
{ "nickname": "홍길동" }
```

**응답 (200):**
```json
{
  "accessToken":  "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "expiresIn":    900
}
```

#### POST /api/auth/refresh — 토큰 갱신

**요청 헤더:** `Authorization: Bearer <RefreshToken>`

**응답 (200):**
```json
{
  "accessToken": "eyJhbGci...",
  "expiresIn":   900
}
```

#### POST /api/auth/logout — 로그아웃

**요청 헤더:** `Authorization: Bearer <AccessToken>`

**응답:** `204 No Content`  
AccessToken을 Redis 블랙리스트에 등록하고 RefreshToken을 삭제합니다.

---

### SPEC-API-011 — Cursor-based 메시지 조회

#### GET /api/rooms/{roomId}/messages

> 무한 스크롤 메시지 히스토리를 위한 Cursor-based 페이징.  
> **서버:** `api-server` (포트 8081)  
> **요청 헤더:** `Authorization: Bearer <AccessToken>` (필수)

**쿼리 파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `cursor` | string | (없음) | ObjectId hex. 없으면 최신 메시지부터 |
| `limit` | int | 50 | 반환 건수 (최대 100) |
| `direction` | `before`\|`after` | `before` | 커서 이전/이후 |

**응답 (200):**
```json
{
  "messages": [
    {
      "id":             null,
      "chatRoomId":     1,
      "senderId":       42,
      "senderNickname": "홍길동",
      "content":        "안녕하세요",
      "type":           "TEXT",
      "sentAt":         "2026-03-01T10:00:00"
    }
  ],
  "nextCursor": "67c4a1b2e3f5d6a7b8c9d0e1",
  "hasMore":    true
}
```
