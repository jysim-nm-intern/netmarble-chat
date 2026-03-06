## MODIFIED Requirements

### Requirement: 메시지 이미지 업로드
시스템은 `POST /api/chat-rooms/{id}/messages/upload`로 이미지를 수신하면, 로컬 파일 시스템에 저장하고 URL을 DB에 기록한 뒤 WebSocket으로 브로드캐스트해야 한다(SHALL). Base64 인코딩 대신 FileStorageService를 통해 파일을 저장한다.

#### Scenario: 이미지 메시지 전송 성공
- **WHEN** 사용자가 3MB JPG 파일을 `POST /api/chat-rooms/{id}/messages/upload`로 업로드한다
- **THEN** 파일이 `/data/uploads/messages/{date}/{uuid}.jpg`에 저장되고, `Attachment.fileUrl`에 `/uploads/messages/{date}/{uuid}.jpg` URL이 저장되고, `MessageResponse.attachmentUrl`에 해당 URL이 포함되어 `/topic/chatroom.{id}`로 브로드캐스트된다

#### Scenario: 5MB 초과 이미지 업로드 거부
- **WHEN** 사용자가 6MB 파일을 업로드한다
- **THEN** HTTP 400 응답과 함께 "파일 크기가 초과되었습니다." 메시지가 반환된다

#### Scenario: 지원하지 않는 형식 업로드 거부
- **WHEN** 사용자가 `.bmp` 파일을 업로드한다
- **THEN** HTTP 400 응답과 함께 "지원하지 않는 파일 형식입니다." 메시지가 반환된다

### Requirement: 프로필 이미지 업로드
시스템은 `POST /api/users` 요청의 `image` 필드를 수신하면, 로컬 파일 시스템에 저장하고 URL을 DB에 기록해야 한다(SHALL).

#### Scenario: 프로필 이미지 저장
- **WHEN** 사용자가 프로필 이미지(2MB PNG)를 포함하여 `POST /api/users`를 요청한다
- **THEN** 파일이 `/data/uploads/profiles/{date}/{uuid}.png`에 저장되고, `user.profile_image`에 `/uploads/profiles/{date}/{uuid}.png` URL이 저장되고, 응답 JSON의 `profileImage` 필드에 해당 URL이 반환된다

#### Scenario: 프로필 이미지 없이 사용자 생성
- **WHEN** 사용자가 이미지 없이 `POST /api/users`를 요청한다
- **THEN** `user.profile_image`는 null이고, 프론트엔드에서 색상 아바타가 표시된다

### Requirement: 채팅방 썸네일 업로드
시스템은 `POST /api/chat-rooms` 요청의 `image` 필드를 수신하면, 로컬 파일 시스템에 저장하고 URL을 DB에 기록해야 한다(SHALL).

#### Scenario: 채팅방 썸네일 저장
- **WHEN** 사용자가 썸네일(1MB GIF)을 포함하여 `POST /api/chat-rooms`를 요청한다
- **THEN** 파일이 `/data/uploads/rooms/{date}/{uuid}.gif`에 저장되고, `chat_room.image_url`에 `/uploads/rooms/{date}/{uuid}.gif` URL이 저장되고, 응답 JSON의 `imageUrl` 필드에 해당 URL이 반환된다

### Requirement: 이미지 URL 기반 렌더링
프론트엔드는 서버에서 반환된 이미지 URL(`/uploads/...`)을 `<img src>` 속성에 직접 사용해야 한다(SHALL). 기존 Base64 Data URL과 HTTP URL 모두 렌더링을 지원한다.

#### Scenario: URL 기반 이미지 렌더링
- **WHEN** `MessageResponse.attachmentUrl`이 `/uploads/messages/2026/03/04/uuid.jpg`인 메시지를 수신한다
- **THEN** `<img src="/uploads/messages/2026/03/04/uuid.jpg">` 태그로 이미지가 렌더링된다

#### Scenario: 기존 Base64 이미지 하위 호환
- **WHEN** `MessageResponse.attachmentUrl`이 `data:image/png;base64,...`인 기존 메시지를 조회한다
- **THEN** Base64 Data URL이 그대로 렌더링된다 (하위 호환)
