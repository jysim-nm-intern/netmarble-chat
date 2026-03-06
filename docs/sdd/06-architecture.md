# 06. 아키텍처 명세 (Architecture Specifications)

← [목차로 돌아가기](../sdd-specification.md)

---

## 통신 프로토콜 분리 원칙

```
┌─────────────────────────────────────────────────────────────────┐
│                    통신 프로토콜 경계 (핵심 규칙)                   │
│                                                                 │
│   ✅ REST API 사용 영역 (상태 변경, 데이터 조회)                    │
│      ├── 사용자 로그인 / 조회                                      │
│      ├── 채팅방 생성 / 목록(초기 로드) / 입장 / 퇴장               │
│      ├── 메시지 이력 조회 / 검색                                   │
│      └── 이미지 파일 업로드                                        │
│                                                                 │
│   ✅ WebSocket / STOMP 사용 영역 (실시간 이벤트)                   │
│      ├── 메시지 전송     (/app/chat.message)                     │
│      ├── 읽음 처리      (/app/chat.read)                         │
│      ├── 실시간 수신    (/topic/chatroom.{id})                   │
│      ├── 읽음 상태 수신  (/topic/chatroom.{id}.read-status)      │
│      └── 채팅방 목록 실시간 갱신 (/topic/chatroom.{id} × N)       │
│           → 참가중 채팅방의 lastMessage·unreadCount 실시간 반영    │
│                                                                 │
│   ❌ 금지: 실시간 메시지 전송에 REST API 사용                       │
│   ❌ 금지: 채팅방 목록 실시간 갱신을 위한 폴링(Polling) 사용         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 백엔드 계층 구조 (Layered Architecture)

```
┌──────────────────────────────────────────────────┐
│  presentation/                                   │  ← HTTP 요청/응답 처리
│    controller/   (NestJS @Controller)            │     STOMP WebSocket Gateway
│    gateway/      (WebSocket Gateway)             │     DTO 입출력
│    filter/       (GlobalExceptionFilter)         │
├──────────────────────────────────────────────────┤
│              ↓ (Application DTO)                 │
├──────────────────────────────────────────────────┤
│  application/                                    │  ← 유스케이스 조율
│    service/      (@Injectable ApplicationService)│     트랜잭션 경계
│    dto/          (Request/Response class)         │     도메인 서비스 호출
├──────────────────────────────────────────────────┤
│              ↓ (Domain Model)                    │
├──────────────────────────────────────────────────┤
│  domain/                                         │  ← 핵심 비즈니스 로직
│    model/        (순수 TypeScript Entity)         │     외부 기술에 무의존
│    repository/   (Interface)                     │
│    service/      (DomainService)                 │
├──────────────────────────────────────────────────┤
│              ↓ (Interface 구현)                   │
├──────────────────────────────────────────────────┤
│  infrastructure/                                 │  ← 외부 기술 구현체
│    persistence/  (TypeORM Repository 구현)        │
│    mongo/        (Mongoose Document/Repository)  │
│    redis/        (Redis Service)                 │
│    config/       (TypeORM, Mongoose, Redis, WS)  │
└──────────────────────────────────────────────────┘
```

### 계층 간 의존 규칙

| 규칙 | 설명 |
|------|------|
| **단방향 의존** | 상위 계층은 하위 계층을 참조 가능. 역방향 불가. |
| **도메인 독립성** | Domain 계층은 NestJS, TypeORM, Mongoose 등 외부 기술에 직접 의존하지 않는다. |
| **Controller → Repository 직접 호출 금지** | 모든 비즈니스 로직은 Service 계층을 거쳐야 한다. |
| **Entity 직접 반환 금지** | Controller 응답 시 반드시 DTO로 변환한다. |

---

## 패키지 구조 (NestJS — chat-server)

```
server/chat-server/src/
├── main.ts                              ← NestJS 부트스트랩
├── app.module.ts                        ← 루트 모듈
│
├── presentation/
│   ├── controller/
│   │   ├── user.controller.ts           ← POST/GET /api/users
│   │   ├── chat-room.controller.ts      ← POST/GET /api/chat-rooms, join, leave
│   │   ├── chat.controller.ts           ← 메시지 검색, 미읽음 카운트
│   │   ├── message.controller.ts        ← GET /api/messages/chatroom/{id}
│   │   ├── read-status.controller.ts    ← 읽음 상태 REST
│   │   └── health.controller.ts         ← GET /health
│   ├── gateway/
│   │   └── websocket-message.gateway.ts ← STOMP /app/chat.message, chat.read
│   └── filter/
│       └── global-exception.filter.ts   ← @Catch() ExceptionFilter
│
├── application/
│   ├── service/
│   │   ├── user-application.service.ts
│   │   ├── chat-room-application.service.ts
│   │   ├── message-application.service.ts
│   │   └── read-status-application.service.ts
│   └── dto/
│       ├── create-user.request.ts
│       ├── user.response.ts
│       ├── send-message.request.ts
│       ├── message.response.ts
│       └── ...
│
├── domain/
│   ├── model/
│   │   ├── user.entity.ts               ← 순수 TypeScript (외부 기술 무의존)
│   │   ├── chat-room.entity.ts
│   │   ├── chat-room-member.entity.ts
│   │   ├── message.entity.ts
│   │   └── attachment.entity.ts
│   ├── repository/
│   │   ├── user.repository.interface.ts
│   │   ├── chat-room.repository.interface.ts
│   │   ├── chat-room-member.repository.interface.ts
│   │   ├── message.repository.interface.ts
│   │   └── attachment.repository.interface.ts
│   └── service/
│       └── user-domain.service.ts
│
└── infrastructure/
    ├── persistence/
    │   ├── entity/                       ← TypeORM @Entity (인프라 매핑 전용)
    │   │   ├── user.orm-entity.ts
    │   │   ├── chat-room.orm-entity.ts
    │   │   ├── chat-room-member.orm-entity.ts
    │   │   ├── message.orm-entity.ts
    │   │   └── attachment.orm-entity.ts
    │   └── repository/
    │       ├── typeorm-user.repository.ts
    │       ├── typeorm-chat-room.repository.ts
    │       ├── typeorm-chat-room-member.repository.ts
    │       ├── typeorm-message.repository.ts
    │       └── typeorm-attachment.repository.ts
    ├── mongo/
    │   ├── chat-message.document.ts      ← Mongoose @Schema
    │   └── chat-message-mongo.repository.ts
    ├── redis/
    │   └── read-status-redis.service.ts
    └── config/
        ├── typeorm.config.ts
        ├── mongo.config.ts
        ├── redis.config.ts
        └── websocket.config.ts
```

## 패키지 구조 (NestJS — api-server)

```
server/api-server/src/
├── main.ts                              ← NestJS 부트스트랩 (포트 8081)
├── app.module.ts                        ← 루트 모듈
│
├── presentation/
│   └── controller/
│       ├── message-history.controller.ts ← cursor-based 메시지 조회
│       └── health.controller.ts
│
├── application/
│   ├── service/
│   │   └── message-query.service.ts     ← MongoDB 조회 + 커서 페이징
│   └── dto/
│       ├── message.response.ts
│       └── cursor-page.response.ts
│
└── infrastructure/
    └── mongo/
        ├── document/
        │   ├── message.document.ts      ← Mongoose @Schema
        │   └── read-status.document.ts
        └── repository/
            ├── message-mongo.repository.ts
            └── read-status-mongo.repository.ts
```

---

## 프론트엔드 컴포넌트 구조

```
App.jsx
├── Login.jsx                      ← SPEC-USR-001
│
└── ChatRoom.jsx                   ← WebSocket 연결 수명주기 관리 (전역)
    │
    ├── ChatRoomList.jsx           ← SPEC-ROOM-001 (실시간 목록 갱신)
    │   │  ※ 참가중 채팅방 토픽을 WebSocket 구독하여
    │   │    lastMessage·unreadCount를 실시간 갱신
    │   └── CreateChatRoomModal.jsx ← SPEC-ROOM-002
    │
    └── ChatRoomView.jsx           ← SPEC-ROOM-003, SPEC-ROOM-004
        │  ※ WebSocket 연결은 부모(ChatRoom)에서 관리
        │    해당 방의 구독/해제만 담당
        ├── MessageList.jsx        ← SPEC-MSG-001~003, SPEC-READ-001
        ├── MessageInput.jsx       ← SPEC-MSG-001~003
        └── MessageSearch.jsx      ← SPEC-MSG-005
```

### WebSocket 연결 관리 원칙

| 원칙 | 설명 |
|------|------|
| **전역 연결** | WebSocket 연결은 `ChatRoom` 컴포넌트(로그인 후 항상 마운트)에서 한 번 수립한다. |
| **연결 유지** | 채팅방 목록 ↔ 채팅방 내부 간 전환 시에도 WebSocket 연결을 유지한다. |
| **구독 분리** | `ChatRoomList`는 참가중 전체 방의 메시지 토픽을, `ChatRoomView`는 현재 방의 메시지+읽음 상태 토픽을 독립적으로 구독/해제한다. |
| **활성 상태 독립** | 사용자 활성 상태(active/inactive)와 무관하게 WebSocket 연결을 유지한다. 비활성 시에는 해당 방의 구독만 해제한다. |
| **연결 상태 리스너** | `WebSocketService.addConnectionListener(callback)`으로 연결 상태 변화를 구독하여 재연결 시 자동 재구독한다. |

### 상태 관리 (Zustand Store)

| 스토어 | 관리 상태 | 주요 사용 컴포넌트 |
|--------|-----------|-----------------|
| `userStore` | `currentUser` (userId, nickname) | 전체 |
| `chatRoomStore` | `currentRoom`, `roomList` | ChatRoomList, ChatRoomView |
| `messageStore` | `messages`, `unreadCounts` | MessageList, MessageInput |

### API 레이어

```
src/api/
├── axiosConfig.js        ← Axios 인스턴스 (Base URL, 공통 헤더)
├── userService.js        ← POST /users, GET /users/:id
├── chatRoomService.js    ← GET/POST /chat-rooms, join, leave
├── messageService.js     ← GET messages, search, POST attachments
├── readStatusService.js  ← 읽음 처리 REST (보조)
└── activityService.js    ← 활동 시간 갱신

src/services/
└── WebSocketService.js   ← STOMP 연결/구독/발행 캡슐화
                             ※ 연결 상태 변경 리스너 지원
                               addConnectionListener(callback) → unsubscribe fn
```

---

## 인프라 독립성 설계 (Infrastructure Independence)

도메인 비즈니스 로직은 인터페이스를 통해 인프라 기술과 분리된다.

```typescript
// domain/repository/message.repository.interface.ts (기술 독립적 인터페이스)
export interface IMessageRepository {
  save(message: Message): Promise<Message>;
  findByChatRoomIdOrderByCreatedAtDesc(roomId: number): Promise<Message[]>;
  searchByKeyword(roomId: number, keyword: string): Promise<Message[]>;
}

// infrastructure/persistence/repository/typeorm-message.repository.ts (TypeORM 구현체)
@Injectable()
export class TypeormMessageRepository implements IMessageRepository {
  // TypeORM 구현...
}
```

**메시지 발행 추상화:**
```typescript
// 기본 모드: 인메모리 STOMP 브로커
// scale 모드: RabbitMQ STOMP Broker Relay
// → 도메인 코드 수정 없이 인프라 교체 가능
export interface IMessageSender {
  send(destination: string, payload: any): void;
}
```

---

## 2서버 분리 아키텍처 (SPEC-ARCH-002)

### 서버 분리 원칙

```
┌────────────────────────────────────────────────────────────────────┐
│                      2서버 하이브리드 아키텍처                        │
│                                                                    │
│   chat-server (포트 8080, NestJS)                                  │
│   ├── STOMP/WebSocket: 실시간 메시지 송수신, 읽음 처리, 입퇴장 이벤트  │
│   ├── MySQL (TypeORM): 유저, 채팅방, 멤버십 (관계형 데이터)           │
│   ├── MongoDB (Mongoose): 메시지 비동기 쓰기 (fire-and-forget)      │
│   └── Redis (ioredis): 읽음 상태 원자적 카운트                      │
│                                                                    │
│   api-server (포트 8081, NestJS)                                   │
│   ├── REST API: 메시지 이력 조회, cursor-based 페이징                │
│   └── MongoDB (Mongoose): 메시지 읽기 전용                          │
│                                                                    │
│   ❌ 금지: api-server에서 WebSocket/STOMP 사용                      │
│   ❌ 금지: chat-server에서 메시지 이력 REST API 제공                  │
│   ❌ 금지: api-server ↔ chat-server 간 직접 의존                     │
└────────────────────────────────────────────────────────────────────┘
```

### 데이터베이스 역할 분담

| DB | chat-server (쓰기) | api-server (읽기) | 저장 대상 |
|----|-------------------|-------------------|-----------|
| **MySQL** | ✅ TypeORM CRUD | ❌ 미사용 | 유저, 채팅방, 멤버십, 메시지(레거시) |
| **MongoDB** | ✅ 비동기 쓰기 (fire-and-forget) | ✅ 조회 전용 | 메시지 (비정규화, cursor-based) |
| **Redis** | ✅ 읽음 상태 원자적 처리 | ❌ 미사용 | 읽음 카운트, JWT 블랙리스트 |

### Docker Compose 서비스 구성

| 컨테이너 | 포트 | 역할 |
|-----------|------|------|
| `server` (chat-server) | 8080 | STOMP/WebSocket + MySQL + MongoDB 쓰기 + Redis |
| `api-server` | 8081 | REST API + MongoDB 읽기 |
| `mysql` | 3307→3306 | 유저, 채팅방, 멤버십 |
| `mongodb` | 27017 | 메시지 저장 (chat-server 쓰기 / api-server 읽기) |
| `redis` | 6379 | 읽음 상태, JWT 블랙리스트 |
| `client-3000/3001` | 3000, 3001 | 프론트엔드 |

### 계층 간 의존성 규칙

| 규칙 | 설명 |
|------|------|
| `domain` → `infrastructure` 금지 | 도메인이 TypeORM/Mongoose/Redis에 직접 의존 불가 |
| `controller` → `repository` 직접 호출 금지 | Controller는 Service만 호출 |
| `api-server` ↔ `chat-server` 직접 의존 금지 | MongoDB `messages` 컬렉션을 통해서만 데이터 공유 |
| Entity 직접 반환 금지 | Controller 응답 시 반드시 DTO로 변환 |

### 기술 스택

| 구분 | 기술 |
|------|------|
| 런타임 | Node.js 20 LTS |
| 프레임워크 | NestJS 10.x (TypeScript) |
| 메시지 저장소 | MongoDB (cursor-based paging, 비정규화) |
| 채팅방/유저 저장소 | MySQL (TypeORM) |
| 읽음 상태 | Redis (원자적 카운트, ioredis) |
| 인증 | JWT (HS256, AccessToken 15분, RefreshToken 7일) |
| 캐시/블랙리스트 | Redis |
| 비동기 처리 | async/await fire-and-forget (MongoDB 쓰기) |
| STOMP 브로커 | 인메모리 (기본) / RabbitMQ (scale 모드) |
