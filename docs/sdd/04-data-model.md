# 04. 데이터 모델 명세 (Data Model Specifications)

← [목차로 돌아가기](../sdd-specification.md)

---

## Entity 관계도

```
User (1) ─────────────── (N) Participant (N) ─────────────── (1) ChatRoom
  │                              │
  │                              └── last_read_message_id (워터마크)
  │
  └── (1) ──── (N) Message ──── (0..1) Attachment
                    │
                    └── chat_room_id, user_id (FK)
```

**관계 요약:**
- 1명의 User는 여러 ChatRoom에 Participant로 참여할 수 있다.
- 1개의 ChatRoom에는 여러 Message가 속한다.
- 1개의 Message에는 최대 1개의 Attachment가 연결된다.
- Attachment는 반드시 Message에 속한다.

---

## 테이블 명세

### TABLE: `user`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `user_id` | BIGINT | PK, AUTO_INCREMENT | 사용자 고유 식별자 |
| `nickname` | VARCHAR(255) | NOT NULL, UNIQUE | 닉네임 (로그인 키) |
| `profile_color` | VARCHAR(20) | NOT NULL, DEFAULT '#4f85c8' | 프로필 아바타 배경색 (hex 코드) |
| `profile_image` | MEDIUMTEXT | NULL | 프로필 이미지 (Base64 Data URL, 없으면 NULL) |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | 활성 상태 |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 최초 접속 시각 |

**비즈니스 규칙:**
- 동일 닉네임으로 로그인 시 새 레코드를 생성하지 않고 기존 레코드를 반환하되 `profile_color`·`profile_image`는 갱신한다.
- `is_active=false`인 사용자는 로그인 불가로 처리한다.
- `profile_image`가 NULL이면 프론트엔드는 `profile_color` 기반 이니셜 아바타를 표시한다.

**JPA 매핑 유의사항:**
- `nickname` 컬럼에 Unique Index 적용.
- `@Column(nullable = false, unique = true)` 선언 필수.
- `profile_image`는 `@Column(columnDefinition = "MEDIUMTEXT")` 선언 필수.

---

### TABLE: `chat_room`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `chat_room_id` | BIGINT | PK, AUTO_INCREMENT | 채팅방 고유 식별자 |
| `name` | VARCHAR(255) | NOT NULL | 채팅방 이름 |
| `image_url` | MEDIUMTEXT | NULL | 채팅방 썸네일 이미지 URL (Base64 또는 경로, 없으면 NULL) |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Soft Delete 플래그 |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 생성 시각 |

**비즈니스 규칙:**
- `is_active=false`인 방은 목록에 표시되지 않는다.
- 방을 물리적으로 삭제하지 않는다 (Soft Delete 전략).
- `image_url`이 NULL이면 프론트엔드는 멤버 색상 기반 기본 아바타를 표시한다.

---

### TABLE: `participant`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `participant_id` | BIGINT | PK, AUTO_INCREMENT | 참여 기록 식별자 |
| `chat_room_id` | BIGINT | NOT NULL, FK → chat_room | 채팅방 참조 |
| `user_id` | BIGINT | NOT NULL, FK → user | 사용자 참조 |
| `last_read_message_id` | BIGINT | NULL | 읽음 워터마크 |
| `joined_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 입장 시각 |
| `left_at` | TIMESTAMP | NULL | 퇴장 시각 (NULL = 현재 참여 중) |

**비즈니스 규칙:**
- `left_at IS NULL`인 레코드만 "현재 활성 참여자"로 간주한다.
- 동일 사용자가 나갔다가 재입장 시 새 레코드를 생성한다.

**미읽음 카운트 계산 공식:**
```sql
-- 특정 메시지(message_id=M)의 unreadCount
SELECT COUNT(*) FROM participant
WHERE chat_room_id = {roomId}
  AND left_at IS NULL
  AND (last_read_message_id IS NULL OR last_read_message_id < M);
```

---

### TABLE: `message`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `message_id` | BIGINT | PK, AUTO_INCREMENT | 메시지 고유 식별자 |
| `chat_room_id` | BIGINT | NOT NULL, FK → chat_room | 채팅방 참조 |
| `user_id` | BIGINT | NULL, FK → user | 발신자 (SYSTEM 메시지는 NULL) |
| `message_type` | VARCHAR(50) | NOT NULL | TEXT / IMAGE / STICKER / SYSTEM |
| `content` | TEXT | NOT NULL | 메시지 내용 |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 전송 시각 |

**비즈니스 규칙:**
- `message_type=SYSTEM`이면 `user_id`가 NULL이다.
- `content` 컬럼은 검색 기능을 위해 Full-Text Index 적용을 권장한다.

**인덱스 권장사항:**
```sql
-- 채팅방별 메시지 조회 성능
CREATE INDEX idx_message_room_created ON message(chat_room_id, created_at DESC);

-- 메시지 검색 성능
ALTER TABLE message ADD FULLTEXT INDEX idx_message_content(content);
```

---

### TABLE: `attachment`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `attachment_id` | BIGINT | PK, AUTO_INCREMENT | 첨부 파일 식별자 |
| `message_id` | BIGINT | NOT NULL, FK → message | 메시지 참조 |
| `file_url` | VARCHAR(500) | NOT NULL | 파일 접근 URL |
| `file_type` | VARCHAR(50) | NOT NULL | IMAGE / STICKER |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 업로드 시각 |

**비즈니스 규칙:**
- `file_type=STICKER`인 경우 `file_url`은 스티커 ID(예: `STK_01`)를 저장한다.
- `file_type=IMAGE`인 경우 `file_url`은 서버에서 접근 가능한 파일 경로 URL이다.

---

## DDL (전체 스크립트)

```sql
CREATE TABLE `user` (
  `user_id`    BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `nickname`   VARCHAR(255) NOT NULL UNIQUE COMMENT '닉네임 (로그인 키)',
  `is_active`  BOOLEAN      NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `chat_room` (
  `chat_room_id` BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name`         VARCHAR(255) NOT NULL COMMENT '채팅방 이름',
  `image_url`    MEDIUMTEXT   NULL     COMMENT '채팅방 썸네일 이미지 URL (Base64 또는 경로)',
  `is_active`    BOOLEAN      NOT NULL DEFAULT TRUE COMMENT 'Soft Delete',
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `participant` (
  `participant_id`      BIGINT    NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `chat_room_id`        BIGINT    NOT NULL,
  `user_id`             BIGINT    NOT NULL,
  `last_read_message_id` BIGINT   NULL COMMENT '읽음 워터마크',
  `joined_at`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `left_at`             TIMESTAMP NULL     COMMENT '퇴장 시각 (NULL=참여 중)',
  CONSTRAINT FK_Participant_ChatRoom FOREIGN KEY (chat_room_id) REFERENCES chat_room(chat_room_id),
  CONSTRAINT FK_Participant_User     FOREIGN KEY (user_id)      REFERENCES user(user_id)
);

CREATE TABLE `message` (
  `message_id`   BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `chat_room_id` BIGINT       NOT NULL,
  `user_id`      BIGINT       NULL     COMMENT 'SYSTEM 메시지는 null',
  `message_type` VARCHAR(50)  NOT NULL COMMENT 'TEXT/IMAGE/STICKER/SYSTEM',
  `content`      TEXT         NOT NULL,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_Message_ChatRoom FOREIGN KEY (chat_room_id) REFERENCES chat_room(chat_room_id),
  CONSTRAINT FK_Message_User     FOREIGN KEY (user_id)      REFERENCES user(user_id)
);

CREATE TABLE `attachment` (
  `attachment_id` BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `message_id`    BIGINT       NOT NULL,
  `file_url`      VARCHAR(500) NOT NULL,
  `file_type`     VARCHAR(50)  NOT NULL COMMENT 'IMAGE/STICKER',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_Attachment_Message FOREIGN KEY (message_id) REFERENCES message(message_id)
);
```
