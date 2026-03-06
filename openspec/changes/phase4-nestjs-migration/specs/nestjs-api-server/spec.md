## ADDED Requirements

### Requirement: NestJS api-server REST API 구현
api-server는 NestJS 프레임워크로 구현하며, MongoDB에서 메시지 이력을 조회하는 REST API를 제공해야 한다(SHALL). 포트 8081에서 동작한다.

**엔드포인트:**
- `GET /api/messages/history/{chatRoomId}` — cursor-based 메시지 이력 조회
- `GET /health` — 헬스체크

#### Scenario: 메시지 이력 조회
- **WHEN** 클라이언트가 `GET /api/messages/history/{chatRoomId}` 요청 시
- **THEN** MongoDB에서 해당 채팅방의 메시지를 cursor-based 페이지네이션으로 반환한다

#### Scenario: 기존 클라이언트 호환성
- **WHEN** 기존 React 클라이언트가 api-server에 메시지 이력을 요청할 때
- **THEN** Spring Boot api-server와 동일한 응답 형식으로 데이터를 반환한다

---

### Requirement: MongoDB Cursor-Based 페이지네이션
api-server는 대용량 메시지 조회 시 cursor-based 페이지네이션을 지원해야 한다(SHALL).

**응답 형식:**
```json
{
  "success": true,
  "data": {
    "messages": [...],
    "nextCursor": "cursor_string_or_null",
    "hasMore": true
  }
}
```

#### Scenario: 첫 페이지 조회
- **WHEN** cursor 파라미터 없이 메시지 이력을 요청할 때
- **THEN** 가장 최근 메시지부터 pageSize개를 반환하고, 이전 메시지가 있으면 nextCursor를 포함한다

#### Scenario: 다음 페이지 조회
- **WHEN** 이전 응답의 nextCursor를 파라미터로 전달할 때
- **THEN** 해당 커서 이전의 메시지를 pageSize개 반환한다

#### Scenario: 마지막 페이지
- **WHEN** 더 이상 조회할 메시지가 없을 때
- **THEN** `hasMore: false`, `nextCursor: null`을 반환한다

---

### Requirement: api-server MongoDB 연결
api-server는 @nestjs/mongoose를 사용하여 MongoDB에 연결하며, 읽기 전용으로만 접근해야 한다(SHALL).

#### Scenario: MongoDB 읽기 전용 동작
- **WHEN** api-server가 MongoDB에 연결할 때
- **THEN** 메시지 조회만 수행하며, 쓰기 작업은 수행하지 않는다

#### Scenario: chat-server와 동일 컬렉션 공유
- **WHEN** chat-server가 MongoDB `messages` 컬렉션에 메시지를 기록할 때
- **THEN** api-server가 동일 컬렉션에서 해당 메시지를 조회할 수 있다
