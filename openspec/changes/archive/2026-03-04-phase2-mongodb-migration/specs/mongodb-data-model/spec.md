## ADDED Requirements

### Requirement: MongoDB 비정규화 문서 모델 설계
시스템은 채팅 메시지와 읽음 상태를 MySQL 정규화 스키마 대신 MongoDB 비정규화 문서 컬렉션으로 저장해야(SHALL) 한다. `rooms`, `messages`, `read_status` 세 컬렉션을 정의하며, 자주 함께 조회되는 데이터는 동일 문서에 임베드한다.

**컬렉션 스키마:**

```
[messages 컬렉션]
{
  _id: ObjectId,
  roomId: String (UUID),
  senderId: String (UUID),
  senderNickname: String,      // 비정규화 (User 조인 제거)
  content: String,
  type: Enum["TEXT", "IMAGE", "SYSTEM"],
  readCount: Number,           // Redis와 주기적 동기화
  createdAt: ISODate
}

[read_status 컬렉션 — 대규모 방(500명 초과) 전용]
{
  _id: ObjectId,
  messageId: String,
  userId: String,
  readAt: ISODate
}
```

#### Scenario: 메시지 저장 시 발신자 닉네임 비정규화
- **WHEN** 유저가 채팅 메시지를 전송할 때
- **THEN** 시스템은 해당 시점 유저 닉네임을 `senderNickname` 필드에 포함하여 저장해야 한다

#### Scenario: 500명 이하 채팅방의 읽음 상태 처리
- **WHEN** 채팅방 동시 접속 유저가 500명 이하일 때 읽음 이벤트가 발생하면
- **THEN** 시스템은 `messages.readCount`를 Redis를 통해 원자적으로 증가시키고 배치로 MongoDB에 반영해야 한다

#### Scenario: 500명 초과 채팅방의 읽음 상태 처리
- **WHEN** 채팅방 동시 접속 유저가 500명을 초과할 때 읽음 이벤트가 발생하면
- **THEN** 시스템은 `read_status` 컬렉션에 별도 문서로 저장해야 하며 `messages` 문서 크기를 16MB 이하로 유지해야 한다

---

### Requirement: MongoDB 인덱스 전략
시스템은 메시지 조회 성능을 보장하기 위해 `messages` 컬렉션에 복합 인덱스를 반드시(MUST) 생성해야 한다.

**필수 인덱스:**
```
// 채팅방 메시지 시간순 조회 (Cursor-based 페이징 핵심)
db.messages.createIndex({ roomId: 1, _id: -1 })

// 특정 유저의 메시지 이력 조회
db.messages.createIndex({ senderId: 1, createdAt: -1 })

// read_status 컬렉션: 메시지별 읽음 집계
db.read_status.createIndex({ messageId: 1, userId: 1 }, { unique: true })
```

#### Scenario: 대용량 메시지 이력 조회 성능
- **WHEN** 메시지 10만 건 이상이 저장된 채팅방에서 이전 메시지 50건을 조회할 때
- **THEN** 시스템은 `{ roomId, _id: { $lt: cursor } }` 조건으로 인덱스를 타서 Collection Scan 없이 응답해야 한다

#### Scenario: 인덱스 존재 검증 (애플리케이션 시작 시)
- **WHEN** 애플리케이션이 시작될 때
- **THEN** 시스템은 필수 인덱스가 없으면 자동으로 생성하거나 경고 로그를 남겨야 한다

---

### Requirement: Cursor-based 메시지 페이징 API
시스템은 메시지 이력 조회 API에서 Offset 방식 대신 Cursor 기반 페이징을 사용해야(SHALL) 한다.

**API 계약:**
```
GET /api/rooms/{roomId}/messages?cursor={lastMessageId}&limit=50&direction=BEFORE
응답: { messages: [...], nextCursor: "ObjectId", hasMore: boolean }
```
- `cursor` 미지정 시 최신 메시지부터 반환
- `direction=BEFORE`: cursor 이전 메시지 조회 (기본값)
- `direction=AFTER`: cursor 이후 메시지 조회 (실시간 보완용)
- `limit` 최대값: 100

#### Scenario: 초기 메시지 로드
- **WHEN** 클라이언트가 cursor 없이 메시지 조회 요청을 보내면
- **THEN** 시스템은 최신 메시지 50건을 반환하고 `nextCursor`를 응답에 포함해야 한다

#### Scenario: 이전 메시지 로드 (무한 스크롤)
- **WHEN** 클라이언트가 `cursor={oldestMessageId}&direction=BEFORE`로 요청하면
- **THEN** 시스템은 해당 메시지보다 이전에 생성된 메시지 최대 50건을 오래된 순으로 반환해야 한다

#### Scenario: 마지막 페이지 감지
- **WHEN** 더 이상 이전 메시지가 없을 때
- **THEN** 시스템은 `hasMore: false`와 `nextCursor: null`을 응답해야 한다
