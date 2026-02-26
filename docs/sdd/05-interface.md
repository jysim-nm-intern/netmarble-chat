# 05. 인터페이스 명세 (Interface Specifications)

← [목차로 돌아가기](../sdd-specification.md)

---

## 공통 규칙

- **Base URL:** `http://localhost:8080/api`
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
| **브로커** | Spring Boot 내장 SimpleBroker |
| **구독 prefix** | `/topic` |
| **발행 prefix** | `/app` |

---

### 구독 경로 (서버 → 클라이언트)

#### /topic/room/{roomId}

채팅방의 실시간 이벤트를 수신한다. 수신 데이터는 이벤트 유형에 따라 두 가지 형태이다.

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
