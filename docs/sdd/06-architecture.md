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
│      ├── 채팅방 생성 / 목록 / 입장 / 퇴장                          │
│      ├── 메시지 이력 조회 / 검색                                   │
│      └── 이미지 파일 업로드                                        │
│                                                                 │
│   ✅ WebSocket / STOMP 사용 영역 (실시간 이벤트)                   │
│      ├── 메시지 전송  (/app/chat.message)                        │
│      ├── 읽음 처리   (/app/chat.read)                            │
│      └── 실시간 수신 (/topic/room/{id})                          │
│                                                                 │
│   ❌ 금지: 실시간 메시지 전송에 REST API 사용                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 백엔드 계층 구조 (Layered Architecture)

```
┌──────────────────────────────────────────────┐
│  presentation/                               │  ← HTTP 요청/응답 처리
│    controller/   (REST Controller)           │     WebSocket 메시지 매핑
│    exception/    (GlobalExceptionHandler)    │     DTO 입출력
├──────────────────────────────────────────────┤
│              ↓ (Application DTO)             │
├──────────────────────────────────────────────┤
│  application/                                │  ← 유스케이스 조율
│    service/      (ApplicationService)        │     트랜잭션 경계
│    dto/          (Request/Response Record)   │     도메인 서비스 호출
├──────────────────────────────────────────────┤
│              ↓ (Domain Model)                │
├──────────────────────────────────────────────┤
│  domain/                                     │  ← 핵심 비즈니스 로직
│    model/        (Entity)                    │     외부 기술에 무의존
│    repository/   (Interface)                 │
│    service/      (DomainService)             │
├──────────────────────────────────────────────┤
│              ↓ (Interface 구현)              │
├──────────────────────────────────────────────┤
│  infrastructure/                             │  ← 외부 기술 구현체
│    persistence/  (JPA Repository 구현)       │
│    config/       (WebSocketConfig, WebConfig)│
└──────────────────────────────────────────────┘
```

### 계층 간 의존 규칙

| 규칙 | 설명 |
|------|------|
| **단방향 의존** | 상위 계층은 하위 계층을 참조 가능. 역방향 불가. |
| **도메인 독립성** | Domain 계층은 Spring, JPA, STOMP 등 외부 기술에 직접 의존하지 않는다. |
| **Controller → Repository 직접 호출 금지** | 모든 비즈니스 로직은 Service 계층을 거쳐야 한다. |
| **Entity 직접 반환 금지** | Controller 응답 시 반드시 DTO로 변환한다. |

---

## 패키지 구조

```
com.netmarble.chat
├── presentation/
│   ├── controller/
│   │   ├── UserController.java
│   │   ├── ChatRoomController.java
│   │   ├── ChatController.java         ← 메시지 이력/검색 REST
│   │   ├── WebSocketMessageController.java ← STOMP @MessageMapping
│   │   ├── ReadStatusController.java
│   │   └── HealthController.java
│   └── exception/
│       ├── GlobalExceptionHandler.java
│       └── ErrorResponse.java
│
├── application/
│   ├── service/
│   │   ├── UserApplicationService.java
│   │   ├── ChatRoomApplicationService.java
│   │   ├── MessageApplicationService.java
│   │   └── ReadStatusApplicationService.java
│   └── dto/
│       ├── CreateUserRequest.java
│       ├── UserResponse.java
│       ├── SendMessageRequest.java
│       ├── MessageResponse.java
│       └── ...
│
├── domain/
│   ├── model/
│   │   ├── User.java
│   │   ├── ChatRoom.java
│   │   ├── ChatRoomMember.java
│   │   ├── Message.java
│   │   └── ReadStatus.java
│   ├── repository/
│   │   ├── UserRepository.java         ← Interface
│   │   ├── ChatRoomRepository.java     ← Interface
│   │   ├── MessageRepository.java      ← Interface
│   │   └── ReadStatusRepository.java   ← Interface
│   └── service/
│       └── UserDomainService.java
│
└── infrastructure/
    ├── persistence/
    │   ├── JpaUserRepository.java
    │   ├── JpaChatRoomRepository.java
    │   ├── JpaMessageRepository.java
    │   └── JpaReadStatusRepository.java
    └── config/
        ├── WebSocketConfig.java
        └── WebConfig.java
```

---

## 프론트엔드 컴포넌트 구조

```
App.jsx
├── Login.jsx                     ← SPEC-USR-001
│
├── ChatRoomList.jsx               ← SPEC-ROOM-001
│   └── CreateChatRoomModal.jsx    ← SPEC-ROOM-002
│
└── ChatRoomView.jsx               ← SPEC-ROOM-003, SPEC-ROOM-004
    ├── MessageList.jsx            ← SPEC-MSG-001~003, SPEC-READ-001
    ├── MessageInput.jsx           ← SPEC-MSG-001~003
    └── MessageSearch.jsx          ← SPEC-MSG-005
```

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
```

---

## 인프라 독립성 설계 (Infrastructure Independence)

도메인 비즈니스 로직은 인터페이스를 통해 인프라 기술과 분리된다.

```java
// domain/repository/MessageRepository.java (기술 독립적 인터페이스)
public interface MessageRepository {
    Message save(Message message);
    List<Message> findByChatRoomIdOrderByCreatedAtDesc(Long roomId);
    List<Message> searchByKeyword(Long roomId, String keyword);
}

// infrastructure/persistence/JpaMessageRepository.java (JPA 구현체)
@Repository
public class JpaMessageRepository implements MessageRepository {
    // JPA 구현...
}

// 향후 교체 가능:
// class MongoMessageRepository implements MessageRepository { ... }
```

**메시지 발행 추상화:**
```java
// 현재: StompMessageSender (SimpleBroker)
// 향후: KafkaMessageSender 또는 RabbitMQMessageSender
// → 도메인 코드 수정 없이 인프라 교체 가능
interface MessageSender {
    void send(String destination, Object payload);
}
```
