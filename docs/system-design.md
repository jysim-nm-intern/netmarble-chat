# 시스템 설계 문서 — Real-Time Multi-Chat

> 본 문서는 Phase 1 → 2 → 3 → 4 진화 과정에 따른 시스템 아키텍처, 기술 스택, 데이터 모델, API 설계, 시스템 구성도를 정리합니다.

---

## 목차

1. [시스템 아키텍처 개요](#1-시스템-아키텍처-개요)
2. [기술 스택 구성](#2-기술-스택-구성)
3. [데이터 모델](#3-데이터-모델)
4. [API 설계](#4-api-설계)
5. [시스템 구성도](#5-시스템-구성도)

---

## 1. 시스템 아키텍처 개요

### 공통 원칙 (전 Phase 공통)

| 원칙 | 설명 |
|------|------|
| **Hybrid Communication Protocol** | REST API(상태 조회/변경) + WebSocket STOMP(실시간 메시징)를 혼합 사용한다. 실시간 메시지 전송은 반드시 STOMP `/app` 경로를 거친다. |
| **Domain-Driven Decoupling** | Presentation → Application → Domain → Infrastructure 계층을 분리한다. Domain은 외부 기술 스택(TypeORM, Mongoose, Redis 등)에 의존하지 않는다. |
| **Interface 기반 추상화** | 데이터 저장소와 메시징 브로커는 Interface를 통해 추상화하여 인프라 교체 시 도메인 코드 변경 없이 대응한다. |

### Phase별 아키텍처 진화

| 구분 | Phase 1 (MVP) | Phase 2 (최적화) | Phase 3 (수평 확장) | Phase 4 (NestJS 마이그레이션) |
|------|---------------|-----------------|-------------------|-------------------------------|
| **서버 구성** | 단일 서버 (chat-server) | 2서버 분리 (chat-server + api-server) | N서버 (chat-server ×N + api-server) | Phase 3 동일 (런타임만 전환) |
| **백엔드 언어** | Java 17 / Spring Boot 3 | Java 17 / Spring Boot 3 | Java 17 / Spring Boot 3 | Node.js 20 / NestJS 10.x |
| **메시지 브로커** | 인메모리 STOMP 브로커 | 인메모리 STOMP 브로커 | RabbitMQ STOMP Relay (외부 브로커) | RabbitMQ STOMP Relay (동일) |
| **데이터 저장소** | MySQL 단일 | MySQL + MongoDB + Redis | MySQL + MongoDB + Redis | MySQL + MongoDB + Redis (동일) |
| **이미지 저장** | Base64 → DB 저장 | Base64 → DB 저장 | 로컬 파일 시스템 + Nginx 정적 서빙 | 로컬 FS + Nginx (동일) |
| **로드 밸런싱** | 없음 (단일 서버) | 없음 (수동 포트 분리) | Nginx Reverse Proxy | Nginx Reverse Proxy (동일) |
| **동시 접속** | ~400명 | ~1,000명 | 1,000명 (실측) | 측정 예정 |
| **방당 사용자** | ~200명 | ~200명 | 500명+ | 측정 예정 |
| **Docker 이미지** | ~400MB (JRE) | ~400MB (JRE) | ~400MB (JRE) | ~150MB (Alpine) |
| **메모리 (idle)** | ~300MB (JVM) | ~300MB (JVM) | ~300MB (JVM) | ~50MB (Node.js) |

---

## 2. 기술 스택 구성

### 공통 기술 스택 (전 Phase 공통)

> Phase 1~3은 Java 17 / Spring Boot 3 기반이며, Phase 4에서 Node.js 20 / NestJS 10.x로 마이그레이션되었다.
> 아래 표는 Phase 4(현행) 기준 기술 스택이다.

#### Backend
| 분류 | 기술 | 버전 | 용도 | Phase 1~3 대응 기술 |
|------|------|------|------|---------------------|
| Runtime | Node.js | 20 LTS | JavaScript 런타임 | Java 17 (JVM) |
| Framework | NestJS | 10.x | 웹 애플리케이션 프레임워크 | Spring Boot 3 |
| ORM | TypeORM | — | MySQL 데이터 접근 | JPA / Hibernate |
| ODM | Mongoose (@nestjs/mongoose) | — | MongoDB 데이터 접근 | Spring Data MongoDB |
| WebSocket | stomp-broker-js + ws | — | STOMP 프로토콜 기반 실시간 통신 | Spring SimpleBroker |
| Build | npm + TypeScript | — | 빌드 및 패키지 관리 | Gradle + Java |

#### Frontend
| 분류 | 기술 | 버전 | 용도 |
|------|------|------|------|
| Library | React | 18 | UI 렌더링 |
| Bundler | Vite | — | 빌드 및 개발 서버 |
| 상태 관리 | Zustand | — | 전역 상태 (메시지 리스트, 유저 세션) |
| 스타일링 | TailwindCSS | — | 유틸리티 기반 CSS |
| HTTP | Axios | — | REST API 호출 |
| WebSocket | @stomp/stompjs | — | STOMP 클라이언트 |

#### 테스트
| 분류 | 기술 | 용도 | Phase 1~3 대응 기술 |
|------|------|------|---------------------|
| Backend 단위 | Jest + @nestjs/testing | 서비스 로직 단위 테스트 | JUnit 5 + Mockito |
| Backend 통합 | Jest + 실제 DB | MySQL/MongoDB/Redis 연동 통합 테스트 | @SpringBootTest + Testcontainers |
| Frontend 단위 | Vitest + RTL | 컴포넌트 및 로직 단위 테스트 | (동일) |
| E2E | Playwright | 브라우저 기반 End-to-End 테스트 | (동일) |
| 부하 테스트 | k6 | REST + WebSocket/STOMP 부하 측정 | (동일) |

### Phase별 추가 기술 스택

#### Phase 1 — 추가 없음
- MySQL 8.0만 사용 (메시지 포함 모든 데이터)

#### Phase 2 — 데이터 저장소 확장
| 분류 | 기술 | 버전 | 용도 |
|------|------|------|------|
| Document DB | MongoDB | 6.0 | 메시지 저장소 (비정규화, 커서 기반 페이징) |
| Cache/Store | Redis | 7.0 | 읽음 처리 원자 연산, JWT 블랙리스트 |
| 인증 | JWT (HS256) | — | AccessToken(15분) + RefreshToken(7일) |
| 비동기 | async/await | — | MongoDB 비동기 쓰기 (fire-and-forget) |

#### Phase 3 — 인프라 확장
| 분류 | 기술 | 버전 | 용도 |
|------|------|------|------|
| Message Broker | RabbitMQ | 3.13+ | STOMP Relay (다중 인스턴스 메시지 동기화) |
| Load Balancer | Nginx | 1.25 | 리버스 프록시, WebSocket Upgrade, 정적 파일 서빙 |
| File Storage | Local FS | — | 이미지 업로드 (`/data/uploads/`) |
| Orchestration | Docker Compose | — | 프로필 기반 서비스 오케스트레이션 |

#### Phase 4 — NestJS 마이그레이션 (기술 스택 전환)

> Phase 3 인프라(DB, RabbitMQ, Nginx)는 그대로 유지하고, 서버 런타임만 Java → Node.js로 전환한다.
> 기존 Java 서버는 `-spring` 접미사로 보존하여 A/B 성능 비교에 활용한다.

| 분류 | 전환 전 (Java) | 전환 후 (Node.js) | 비고 |
|------|---------------|-------------------|------|
| Runtime | Java 17 (JVM) | Node.js 20 LTS | 이벤트 루프 기반 |
| Framework | Spring Boot 3 | NestJS 10.x | 데코레이터 기반 DI, 구조적 1:1 대응 |
| ORM (MySQL) | JPA / Hibernate | TypeORM | Repository 패턴 동일 유지 |
| ODM (MongoDB) | Spring Data MongoDB | Mongoose (@nestjs/mongoose) | 비동기 쓰기 패턴 유지 |
| Redis 클라이언트 | Spring Data Redis | ioredis | 원자적 카운트 동일 |
| STOMP 브로커 | Spring SimpleBroker | stomp-broker-js + ws | Scale 모드: RabbitMQ Relay 동일 |
| 테스트 | JUnit 5 + Mockito | Jest + @nestjs/testing | 커버리지 도구: istanbul |
| Docker 이미지 | eclipse-temurin:17-jre (~400MB) | node:20-alpine (~150MB) | 60% 크기 감소 |
| 메모리 (idle) | 200~400MB (JVM 힙) | 30~80MB | 83% 메모리 절감 |

---

## 3. 데이터 모델

### 3.1 공통 — MySQL (전 Phase 공통, Phase별 스키마 진화)

```
┌─────────────────────────────────────────────────────────────────┐
│                        MySQL 8.0 Schema                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐         ┌──────────────────┐                  │
│  │    user       │         │   chat_room       │                 │
│  ├──────────────┤         ├──────────────────┤                  │
│  │ PK user_id   │         │ PK chat_room_id  │                  │
│  │    nickname   │◄──┐    │    name           │                  │
│  │    profile_*  │   │    │    image_url      │                  │
│  │    is_active  │   │    │    is_active      │                  │
│  │    created_at │   │    │    created_at     │                  │
│  └──────────────┘   │    └──────────────────┘                   │
│                      │             ▲                             │
│                      │             │                             │
│                      │    ┌────────┴─────────┐                  │
│                      └───►│   participant     │                  │
│                           ├──────────────────┤                  │
│                           │ PK participant_id │                  │
│                           │ FK chat_room_id   │                  │
│                           │ FK user_id        │                  │
│                           │ last_read_msg_id  │                  │
│                           │    joined_at      │                  │
│                           │    left_at (NULL) │                  │
│                           └──────────────────┘                  │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ message (Ph.1)   │    │ attachment (Ph.3) │                   │
│  ├──────────────────┤    ├──────────────────┤                   │
│  │ PK message_id    │    │ PK attachment_id  │                   │
│  │ FK chat_room_id  │    │ FK message_id     │                   │
│  │ FK user_id       │    │    file_url        │                  │
│  │    message_type  │    │    file_type       │                   │
│  │    content       │    │    created_at      │                   │
│  │    created_at    │    └──────────────────┘                   │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

#### Phase별 스키마 변경 이력

| Phase | 변경 사항 |
|-------|----------|
| **Phase 1** | `user`, `chat_room`, `participant`, `message` 테이블 생성. `profile_image`와 `image_url`은 MEDIUMTEXT(Base64) |
| **Phase 2** | `message` 테이블의 역할이 MongoDB로 이전됨 (MySQL의 message 테이블은 레거시). `participant.last_read_message_id` 추가 |
| **Phase 3** | `user.profile_image` → VARCHAR(500) URL 경로로 변경. `chat_room.image_url` → VARCHAR(500) URL 경로로 변경. `attachment` 테이블 신규 |
| **Phase 4** | 스키마 변경 없음. ORM을 JPA → TypeORM으로 전환하되 동일 테이블 매핑 유지. ODM을 Spring Data MongoDB → Mongoose로 전환 |

### 3.2 Phase 2+ — MongoDB (메시지 저장소)

```
┌─────────────────────────────────────────────────────┐
│               MongoDB — messages 컬렉션              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  {                                                  │
│    _id:             ObjectId       ← 커서 페이징 PK  │
│    roomId:          String         ← MySQL FK       │
│    senderId:        String         ← MySQL FK       │
│    senderNickname:  String         ← 비정규화        │
│    content:         String                          │
│    type:            "TEXT"|"IMAGE"|"STICKER"|"SYSTEM"│
│    attachmentUrl:   String|null    ← /uploads/...   │
│    attachmentType:  String|null                     │
│    readCount:       Integer        ← 기본값 0       │
│    createdAt:       ISODate                         │
│  }                                                  │
│                                                     │
│  인덱스:                                             │
│   • { roomId: 1, _id: -1 }    → 커서 기반 페이징    │
│   • { senderId: 1 }           → 발신자별 조회       │
│   • { createdAt: -1 }         → 시간순 정렬         │
│                                                     │
├─────────────────────────────────────────────────────┤
│           MongoDB — read_statuses 컬렉션             │
├─────────────────────────────────────────────────────┤
│  {                                                  │
│    _id:       ObjectId                              │
│    messageId: String                                │
│    userId:    String                                │
│    readAt:    ISODate                               │
│  }                                                  │
│  UNIQUE INDEX: { messageId: 1, userId: 1 }          │
└─────────────────────────────────────────────────────┘
```

### 3.3 Phase 2+ — Redis (캐시 및 상태 저장)

```
┌─────────────────────────────────────────────────────┐
│                    Redis 7.0 — Key 구조              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  chat:read:{roomId}:{userId}                        │
│    → Value: last_read_message_id (Integer)          │
│    → 용도: 읽음 처리 워터마크 원자 연산              │
│                                                     │
│  jwt:blacklist:{jti}                                │
│    → Value: TTL 기반 자동 만료                       │
│    → 용도: 로그아웃된 JWT 토큰 무효화                │
│                                                     │
│  auth:refresh:{userId}                              │
│    → Value: RefreshToken                            │
│    → 용도: 리프레시 토큰 저장 (7일 TTL)              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3.4 데이터 저장소 역할 분담 요약

```
                Phase 1           Phase 2              Phase 3              Phase 4
              ┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  유저/방/참여 │  MySQL   │     │   MySQL     │     │   MySQL     │     │   MySQL     │
              ├─────────┤     ├─────────────┤     ├─────────────┤     ├─────────────┤
  메시지       │  MySQL   │ ──► │  MongoDB    │     │  MongoDB    │     │  MongoDB    │
              ├─────────┤     ├─────────────┤     ├─────────────┤     ├─────────────┤
  읽음 상태    │  MySQL   │ ──► │   Redis     │     │   Redis     │     │   Redis     │
              ├─────────┤     ├─────────────┤     ├─────────────┤     ├─────────────┤
  JWT 캐시     │   N/A    │ ──► │   Redis     │     │   Redis     │     │   Redis     │
              ├─────────┤     ├─────────────┤     ├─────────────┤     ├─────────────┤
  이미지       │ DB(Base64)│    │ DB(Base64)  │ ──► │ 로컬 FS     │     │ 로컬 FS     │
              ├─────────┤     ├─────────────┤     ├─────────────┤     ├─────────────┤
  ORM/ODM     │   JPA    │     │    JPA      │     │    JPA      │ ──► │TypeORM/Mongo│
              └─────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## 4. API 설계

### 4.1 공통 설계 원칙

- **REST API**: 유저 접속, 방 CRUD, 이미지 업로드, 메시지 이력 조회, 검색
- **WebSocket STOMP**: 실시간 메시지 송수신, 읽음 처리, 입장/퇴장 이벤트
- 모든 REST 응답은 DTO를 사용하며, Entity를 직접 반환하지 않는다.

### 4.2 REST API

#### 인증 (Phase 2+)

| Method | Endpoint | 설명 | 요청 | 응답 |
|--------|----------|------|------|------|
| `POST` | `/api/auth/login` | 로그인 (JWT 발급) | `{ nickname }` | `{ accessToken, refreshToken, userId }` |
| `POST` | `/api/auth/refresh` | 토큰 갱신 | `{ refreshToken }` | `{ accessToken }` |
| `POST` | `/api/auth/logout` | 로그아웃 (토큰 블랙리스트) | Header: `Authorization: Bearer {token}` | `204 No Content` |

#### 유저 관리

| Method | Endpoint | 설명 | 요청 | 응답 |
|--------|----------|------|------|------|
| `POST` | `/api/users` | 유저 생성/수정 | `multipart: { nickname, profileImage? }` | `{ userId, nickname, profileImage }` |
| `GET` | `/api/users/{userId}` | 유저 정보 조회 | — | `{ userId, nickname, profileImage, profileColor }` |

#### 채팅방 관리

| Method | Endpoint | 설명 | 요청 | 응답 |
|--------|----------|------|------|------|
| `GET` | `/api/chat-rooms?userId={id}` | 참여 중인 방 목록 (안읽은 메시지 수 포함) | — | `[{ roomId, name, imageUrl, unreadCount, lastMessage }]` |
| `POST` | `/api/chat-rooms` | 방 생성 | `multipart: { name, image? }` | `{ roomId, name, imageUrl }` |
| `POST` | `/api/chat-rooms/{id}/join` | 방 입장 | `{ userId }` | `200 OK` |
| `DELETE` | `/api/chat-rooms/{id}/leave` | 방 퇴장 | `{ userId }` | `204 No Content` |
| `GET` | `/api/chat-rooms/{id}/members` | 방 멤버 목록 | — | `[{ userId, nickname, profileImage }]` |

#### 메시지 — chat-server (실시간 서버)

| Method | Endpoint | 설명 | 요청 | 응답 |
|--------|----------|------|------|------|
| `GET` | `/api/chat-rooms/{id}/messages/search` | 메시지 전문 검색 | `?keyword=검색어` | `[{ messageId, content, sender, createdAt }]` |
| `POST` | `/api/messages/attachments` | 이미지 업로드 (Phase 3) | `multipart: { file }` | `{ fileUrl: "/uploads/uuid.jpg" }` |

#### 메시지 — api-server (조회 전용, Phase 2+)

| Method | Endpoint | 설명 | 요청 | 응답 |
|--------|----------|------|------|------|
| `GET` | `/api/rooms/{id}/messages` | 메시지 이력 (커서 기반 페이징) | `?cursor=ObjectId&limit=50` | `{ messages[], nextCursor, hasMore }` |

### 4.3 WebSocket / STOMP 프로토콜

#### 연결

```
WebSocket Endpoint:  ws://{host}/ws-stomp
STOMP Version:       1.2
```

#### 구독 경로 (Server → Client)

| Destination | 설명 | 메시지 형식 |
|-------------|------|------------|
| `/topic/chatroom.{roomId}` | 채팅방의 모든 이벤트 (메시지, 읽음, 입장/퇴장) | 아래 참조 |
| `/topic/chatroom.{roomId}.read-status` | 읽음 상태 업데이트 전용 | `{ messageId, readCount }` |

#### 발행 경로 (Client → Server)

| Destination | 설명 | 요청 본문 |
|-------------|------|----------|
| `/app/chat.message` | 메시지 전송 | `{ roomId, userId, type, content, attachmentUrl? }` |
| `/app/chat.read` | 읽음 처리 | `{ roomId, userId, lastReadMessageId }` |

#### 메시지 포맷

```json
{
  "messageId": 50,
  "userId": 1,
  "nickname": "사용자닉네임",
  "messageType": "TEXT | IMAGE | STICKER | SYSTEM",
  "content": "메시지 본문",
  "attachmentUrl": "/uploads/uuid.jpg",
  "unreadCount": 2,
  "createdAt": "2026-03-04T10:00:00"
}
```

#### SYSTEM 메시지 유형

| type | content 예시 | 트리거 |
|------|-------------|--------|
| `SYSTEM` | `"{nickname}님이 입장했습니다."` | `/app/chat.join` 또는 `POST /api/chat-rooms/{id}/join` |
| `SYSTEM` | `"{nickname}님이 퇴장했습니다."` | `/app/chat.leave` 또는 `DELETE /api/chat-rooms/{id}/leave` |

### 4.4 Phase별 API 라우팅 차이

```
Phase 1 — 단일 서버
  Client ──► chat-server:8080  (REST + STOMP 모두 처리)

Phase 2 — 2서버 분리
  Client ──► chat-server:8080  (REST 상태변경 + STOMP)
  Client ──► api-server:8081   (REST 메시지 조회 전용)

Phase 3 — Nginx 리버스 프록시
  Client ──► Nginx:8888
              ├── /ws-stomp          ──► chat-server (LB, WebSocket Upgrade)
              ├── /api/*             ──► chat-server (LB, Round-Robin)
              ├── /api/rooms/*/messages ──► api-server:8081 (조회 전용)
              └── /uploads/*         ──► 로컬 볼륨 (정적 파일 직접 서빙)

Phase 4 — 동일 라우팅 (서버 런타임만 Java → Node.js 전환)
  Client ──► Nginx:8888             (Phase 3과 동일 라우팅)
              ├── /ws-stomp          ──► chat-server (NestJS, LB)
              ├── /api/*             ──► chat-server (NestJS, LB)
              ├── /api/rooms/*/messages ──► api-server (NestJS, 조회 전용)
              └── /uploads/*         ──► 로컬 볼륨 (정적 파일 직접 서빙)
```

---

## 5. 시스템 구성도

### Phase 1 — MVP (단일 서버 모놀리식)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Phase 1 구성도                           │
│                    "단일 서버 + MySQL 모놀리식"                    │
└─────────────────────────────────────────────────────────────────┘

  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ Browser  │     │ Browser  │     │ Browser  │
  │ (React)  │     │ (React)  │     │ (React)  │
  └────┬─────┘     └────┬─────┘     └────┬─────┘
       │                │                │
       │  HTTP / WebSocket (STOMP)       │
       └────────────────┼────────────────┘
                        │
                        ▼
           ┌────────────────────────┐
           │   chat-server (:8080)  │
           │    NestJS 10.x     │
           ├────────────────────────┤
           │                        │
           │  ┌──────────────────┐  │
           │  │  REST Controller │  │  ← 유저/방/메시지 CRUD
           │  └──────────────────┘  │
           │  ┌──────────────────┐  │
           │  │ STOMP Controller │  │  ← 실시간 메시지 발행
           │  └──────────────────┘  │
           │  ┌──────────────────┐  │
           │  │  SimpleBroker    │  │  ← 인메모리 메시지 브로커
           │  │  (In-Memory)     │  │     /topic 구독 관리
           │  └──────────────────┘  │
           │  ┌──────────────────┐  │
           │  │ TypeORM + MySQL  │  │  ← 모든 데이터 저장
           │  └──────────────────┘  │
           │                        │
           └───────────┬────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   MySQL 8.0     │
              │   (:3306)       │
              ├─────────────────┤
              │  user           │
              │  chat_room      │
              │  participant    │
              │  message        │  ← 메시지도 MySQL 저장
              │                 │
              │  profile_image  │  ← Base64 MEDIUMTEXT
              │  image_url      │  ← Base64 MEDIUMTEXT
              └─────────────────┘

  ┌──────────────────────────────────────────────┐
  │ 특징                                          │
  │ • 서버 1대, DB 1대 — 가장 단순한 구조           │
  │ • STOMP 브로커: 서버 재시작 시 구독 정보 유실     │
  │ • Base64 이미지: DB 용량 비효율                  │
  │ • N+1 문제: 방 목록 조회 시 302 쿼리 발생        │
  │ • 한계: 동시 접속 ~400명, 방당 ~200명            │
  └──────────────────────────────────────────────┘
```

---

### Phase 2 — 최적화 (2서버 분리 + Polyglot Persistence)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Phase 2 구성도                           │
│           "2서버 분리 + MongoDB/Redis 도입 + JWT 인증"            │
└─────────────────────────────────────────────────────────────────┘

  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ Browser  │     │ Browser  │     │ Browser  │
  │ (React)  │     │ (React)  │     │ (React)  │
  └────┬─────┘     └────┬─────┘     └────┬─────┘
       │                │                │
       │  JWT Bearer Token (모든 요청)    │
       └───────┬────────┼────────┬───────┘
               │        │        │
       ┌───────┘        │        └───────┐
       │                │                │
       ▼                ▼                ▼
  ┌─────────┐    ┌─────────────┐   ┌──────────────┐
  │  REST   │    │  WebSocket  │   │   REST 조회   │
  │  상태변경 │    │  (STOMP)    │   │  (메시지 이력) │
  └────┬────┘    └──────┬──────┘   └──────┬───────┘
       │                │                 │
       ▼                ▼                 ▼
  ┌────────────────────────┐    ┌──────────────────┐
  │  chat-server (:8080)   │    │ api-server (:8081)│
  │   NestJS 10.x      │    │  NestJS 10.x  │
  ├────────────────────────┤    ├──────────────────┤
  │ • REST: 유저/방 CRUD    │    │ • REST: 메시지    │
  │ • STOMP: 실시간 메시징   │    │   조회 전용       │
  │ • STOMP 브로커 (메모리) │    │ • 커서 기반 페이징 │
  │ • async MongoDB 쓰기   │    │ • MongoDB 읽기전용 │
  │ • JWT 발급/검증         │    │                  │
  └───┬──────┬──────┬──────┘    └──────┬───────────┘
      │      │      │                  │
      │      │      │                  │
      ▼      ▼      ▼                  ▼
  ┌──────┐┌──────┐┌──────────┐  ┌──────────┐
  │MySQL ││Redis ││ MongoDB  │  │ MongoDB  │
  │(:3306)││(:6379)││ (:27017) │  │ (읽기전용)│
  └──┬───┘└──┬───┘└────┬─────┘  └────┬─────┘
     │       │         │              │
     │       │         └──────────────┘
     │       │          (동일 MongoDB 인스턴스)
     ▼       ▼
  ┌──────────────────────────────────────────────┐
  │ MySQL 8.0              Redis 7.0              │
  │ ┌────────────────┐    ┌─────────────────────┐ │
  │ │ user           │    │ chat:read:{r}:{u}   │ │
  │ │ chat_room      │    │   → 읽음 워터마크    │ │
  │ │ participant    │    │ jwt:blacklist:{jti}  │ │
  │ │                │    │   → 토큰 무효화      │ │
  │ │ (message 제거) │    │ auth:refresh:{uid}   │ │
  │ └────────────────┘    │   → 리프레시 토큰    │ │
  │                       └─────────────────────┘ │
  └──────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────┐
  │ MongoDB 6.0                                   │
  │ ┌─────────────────────────────────┐           │
  │ │ messages (비정규화 + 커서 페이징) │           │
  │ │ read_statuses                    │           │
  │ └─────────────────────────────────┘           │
  └──────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────┐
  │ Phase 1 → 2 개선 포인트                        │
  │ • 쿼리 최적화: 302 → 3~4 쿼리 (98.7% 감소)     │
  │ • MongoDB 커서 페이징: P99 7.04ms               │
  │ • JWT 인증: 세션리스 + 토큰 블랙리스트           │
  │ • Redis 원자 연산: 읽음 처리 동시성 보장          │
  │ • 동시 접속: ~400 → ~1,000명 (2.5배 향상)       │
  │ • 여전히 인메모리 브로커 → 방당 200명 제한 유지    │
  └──────────────────────────────────────────────┘
```

---

### Phase 3 — 수평 확장 (N서버 + 외부 브로커 + 로드 밸런서)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Phase 3 구성도                           │
│      "RabbitMQ STOMP Relay + Nginx LB + 로컬 파일 저장소"        │
└─────────────────────────────────────────────────────────────────┘

  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Browser  │  │ Browser  │  │ Browser  │  │ Browser  │
  │ (React)  │  │ (React)  │  │ (React)  │  │ (React)  │
  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │              │              │              │
       └──────────────┴──────┬───────┴──────────────┘
                             │
                     All traffic via
                      single entry point
                             │
                             ▼
              ┌──────────────────────────┐
              │     Nginx (:8888)         │
              │    Reverse Proxy / LB     │
              ├──────────────────────────┤
              │                          │
              │  /ws-stomp               │ ──► WebSocket Upgrade
              │    → upstream chat_servers│     (Round-Robin)
              │                          │
              │  /api/*                  │ ──► REST 요청
              │    → upstream chat_servers│     (Round-Robin)
              │                          │
              │  /api/rooms/*/messages   │ ──► 메시지 조회
              │    → api-server:8081     │     (전용 라우팅)
              │                          │
              │  /uploads/*              │ ──► 정적 파일 직접 서빙
              │    → /data/uploads/      │     (7일 캐시)
              │                          │
              └─────┬──────────┬─────────┘
                    │          │
         ┌──────────┘          └──────────┐
         │                                │
         ▼                                ▼
  ┌─────────────────┐            ┌─────────────────┐
  │  chat-server-1  │            │  chat-server-2  │
  │   (:8080)       │            │   (:8082)       │
  │  NestJS    │            │  NestJS    │
  ├─────────────────┤            ├─────────────────┤
  │ REST Controller │            │ REST Controller │
  │ STOMP Controller│            │ STOMP Controller│
  │                 │            │                 │
  │ ┌─────────────┐ │            │ ┌─────────────┐ │
  │ │ STOMP Relay │ │◄──────────►│ │ STOMP Relay │ │
  │ │ (RabbitMQ)  │ │  RabbitMQ  │ │ (RabbitMQ)  │ │
  │ └─────────────┘ │  동기화    │ └─────────────┘ │
  │                 │            │                 │
  │ async Mongo 쓰기 │            │ async Mongo 쓰기 │
  │ JWT 검증        │            │ JWT 검증        │
  └──┬──┬──┬──┬─────┘            └──┬──┬──┬──┬─────┘
     │  │  │  │                     │  │  │  │
     │  │  │  └──────────┬──────────┘  │  │  │
     │  │  │             │             │  │  │
     │  │  │             ▼             │  │  │
     │  │  │  ┌─────────────────────┐  │  │  │
     │  │  │  │   RabbitMQ 3.13+    │  │  │  │
     │  │  │  │  STOMP Plugin       │  │  │  │
     │  │  │  │  (:61613 STOMP)     │  │  │  │
     │  │  │  │  (:5672  AMQP)      │  │  │  │
     │  │  │  │  (:15672 관리 UI)    │  │  │  │
     │  │  │  └─────────────────────┘  │  │  │
     │  │  │                           │  │  │
     │  │  └──────────┬────────────────┘  │  │
     │  │             │                   │  │
     │  │             ▼                   │  │
     │  │  ┌─────────────────────┐        │  │
     │  │  │ Shared Upload Volume │        │  │
     │  │  │ /data/uploads/       │        │  │
     │  │  │ (Docker Volume)      │        │  │
     │  │  │                     │        │  │
     │  │  │ ├── profiles/       │        │  │
     │  │  │ ├── rooms/          │        │  │
     │  │  │ └── attachments/    │        │  │
     │  │  └─────────────────────┘        │  │
     │  │                                 │  │
     │  └────────────┬────────────────────┘  │
     │               │                      │
     ▼               ▼                      ▼
  ┌──────┐   ┌──────────────┐         ┌──────────┐
  │MySQL │   │   MongoDB    │         │  Redis   │
  │(:3306)│   │  (:27017)    │         │ (:6379)  │
  └──────┘   └──────┬───────┘         └──────────┘
                    │
                    │ (읽기전용 접근)
                    ▼
            ┌──────────────────┐
            │ api-server (:8081)│
            │  NestJS     │
            ├──────────────────┤
            │ 커서 기반 페이징   │
            │ MongoDB 읽기전용  │
            └──────────────────┘

  ┌──────────────────────────────────────────────────────┐
  │ Phase 2 → 3 개선 포인트                                │
  │ • 인메모리 브로커 → RabbitMQ: 다중 서버 메시지 동기화    │
  │ • 단일 서버 → Nginx LB: 수평 확장 (chat-server ×N)     │
  │ • Base64 DB → 로컬 FS: DB 부하 제거 + Nginx 캐싱       │
  │ • WebSocket Upgrade: Nginx가 WS 프로토콜 자동 전환     │
  │ • 동시 접속: ~1,000 → 3,000명+ (3배 향상 목표)         │
  │ • 방당 사용자: 200 → 500명+ (2.5배 향상 목표)          │
  └──────────────────────────────────────────────────────┘
```

---

### Phase 4 — NestJS 마이그레이션 (기술 스택 전환)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Phase 4 구성도                           │
│     "Java/Spring Boot → Node.js/NestJS 전환 (인프라 무변경)"     │
└─────────────────────────────────────────────────────────────────┘

  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Browser  │  │ Browser  │  │ Browser  │  │ Browser  │
  │ (React)  │  │ (React)  │  │ (React)  │  │ (React)  │
  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │              │              │              │
       │   동일 REST API + STOMP 계약 유지 (클라이언트 무변경)
       └──────────────┴──────┬───────┴──────────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │     Nginx (:8888)         │  ← Phase 3 인프라 그대로
              │    Reverse Proxy / LB     │
              ├──────────────────────────┤
              │  /ws-stomp → chat ×N     │  WebSocket Upgrade
              │  /api/*    → chat ×N     │  REST (Round-Robin)
              │  /api/rooms/*/messages   │  → api-server:8081
              │  /uploads/* → /data/     │  정적 파일 (7일 캐시)
              └─────┬──────────┬─────────┘
                    │          │
         ┌──────────┘          └──────────┐
         │                                │
         ▼                                ▼
  ┌─────────────────┐            ┌─────────────────┐
  │  chat-server-1  │            │  chat-server-2  │
  │  NestJS 10.x    │            │  NestJS 10.x    │
  │  Node.js 20 LTS │            │  Node.js 20 LTS │
  ├─────────────────┤            ├─────────────────┤
  │ @Controller     │            │ @Controller     │
  │  (REST + STOMP) │            │  (REST + STOMP) │
  │ @Injectable     │            │ @Injectable     │
  │  (Application   │            │  (Application   │
  │   Service)      │            │   Service)      │
  │                 │            │                 │
  │ stomp-broker-js │            │ stomp-broker-js │
  │  ↕ RabbitMQ     │◄──────────►│  ↕ RabbitMQ     │
  │    Relay        │   동기화   │    Relay        │
  │                 │            │                 │
  │ TypeORM (MySQL) │            │ TypeORM (MySQL) │
  │ Mongoose (Mongo)│            │ Mongoose (Mongo)│
  │ ioredis (Redis) │            │ ioredis (Redis) │
  └──┬──┬──┬──┬─────┘            └──┬──┬──┬──┬─────┘
     │  │  │  │                     │  │  │  │
     │  │  │  └──────────┬──────────┘  │  │  │
     │  │  │             ▼             │  │  │
     │  │  │  ┌─────────────────────┐  │  │  │
     │  │  │  │   RabbitMQ 3.13+    │  │  │  │
     │  │  │  │  (:61613 STOMP)     │  │  │  │
     │  │  │  │  (:5672  AMQP)      │  │  │  │
     │  │  │  │  (:15672 관리 UI)    │  │  │  │
     │  │  │  └─────────────────────┘  │  │  │
     │  │  │                           │  │  │
     │  │  └──────────┬────────────────┘  │  │
     │  │             ▼                   │  │
     │  │  ┌─────────────────────┐        │  │
     │  │  │ Shared Upload Volume │        │  │
     │  │  │ /data/uploads/       │        │  │
     │  │  └─────────────────────┘        │  │
     │  │                                 │  │
     │  └────────────┬────────────────────┘  │
     │               │                      │
     ▼               ▼                      ▼
  ┌──────┐   ┌──────────────┐         ┌──────────┐
  │MySQL │   │   MongoDB    │         │  Redis   │
  │(:3306)│   │  (:27017)    │         │ (:6379)  │
  └──────┘   └──────┬───────┘         └──────────┘
                    │ (읽기전용 접근)
                    ▼
            ┌──────────────────┐
            │ api-server (:8081)│
            │ NestJS 10.x      │
            │ Node.js 20 LTS   │
            ├──────────────────┤
            │ 커서 기반 페이징   │
            │ Mongoose 읽기전용 │
            └──────────────────┘

  ┌──────────────────────────────────────────────────────┐
  │ Phase 3 → 4 변경 포인트                                │
  │ • Java 17/Spring Boot → Node.js 20/NestJS 10.x       │
  │ • JPA/Hibernate → TypeORM (동일 스키마 매핑)           │
  │ • Spring SimpleBroker → stomp-broker-js               │
  │ • JUnit/Mockito → Jest/@nestjs/testing                │
  │ • Docker 이미지: ~400MB → ~150MB (60% 감소)            │
  │ • 메모리(idle): ~300MB → ~50MB (83% 감소)              │
  │ • 클라이언트/DB 스키마/API 계약: 무변경                  │
  │ • 기존 Java 서버: -spring 접미사로 보존 (A/B 비교용)     │
  └──────────────────────────────────────────────────────┘
```

---

### Phase 1 → 2 → 3 → 4 진화 비교 (한눈에 보기)

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                        아키텍처 진화 비교 — Phase 1 → 2 → 3 → 4                          ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                        ║
║  Phase 1             Phase 2             Phase 3             Phase 4                   ║
║  (MVP)               (최적화)             (수평 확장)          (NestJS 마이그레이션)      ║
║  ─────────           ─────────           ─────────           ─────────                 ║
║                                                                                        ║
║  [Client]            [Client]            [Client]            [Client]                  ║
║     │                   │                   │                   │                      ║
║     │                   │                   ▼                   ▼                      ║
║     │                   │              ┌─────────┐        ┌─────────┐                 ║
║     │                   │              │  Nginx   │        │  Nginx   │                 ║
║     │                   │              │  (LB)    │        │  (LB)    │                 ║
║     │                   │              └──┬───┬───┘        └──┬───┬───┘                 ║
║     │                   │                 │   │               │   │                    ║
║     ▼                ┌──┴──┐          ┌───┘   └───┐       ┌───┘   └───┐                ║
║  ┌──────┐         ┌──┴──┐  │       ┌──┴──┐     ┌──┴──┐ ┌──┴──┐     ┌──┴──┐            ║
║  │ chat │         │chat │  │       │chat │     │chat │ │chat │     │chat │            ║
║  │server│         │srvr │  │       │srv-1│     │srv-2│ │srv-1│     │srv-2│            ║
║  │(Java)│         │(Java)│ │       │(Java)│    │(Java)│ │(Node)│    │(Node)│           ║
║  └──┬───┘         └──┬──┘  │       └──┬──┘     └──┬──┘ └──┬──┘     └──┬──┘            ║
║     │                │  ┌──┴──┐       │  ┌──────┐ │       │  ┌──────┐ │               ║
║     │                │  │ api │       └──┤Rabbit├─┘       └──┤Rabbit├─┘               ║
║     │                │  │srvr │          │  MQ  │            │  MQ  │                  ║
║     │                │  │(Java)│         └──────┘            └──────┘                  ║
║     │                │  └──┬──┘             │                   │                      ║
║     │                │     │             ┌──┴──┐             ┌──┴──┐                   ║
║     │                │     │             │ api │             │ api │                   ║
║     │                │     │             │srvr │             │srvr │                   ║
║     │                │     │             │(Java)│            │(Node)│                  ║
║     │                │     │             └──┬──┘             └──┬──┘                   ║
║     ▼                ▼     ▼                ▼                   ▼                      ║
║  ┌──────┐     ┌─────┬─────┬─────┐  ┌─────┬─────┬─────┬──────┐ (동일 인프라)           ║
║  │MySQL │     │MySQL│Mongo│Redis│  │MySQL│Mongo│Redis│Local │                          ║
║  │      │     │     │  DB │     │  │     │  DB │     │  FS  │                          ║
║  └──────┘     └─────┴─────┴─────┘  └─────┴─────┴─────┴──────┘                          ║
║                                                                                        ║
║  언어: Java        Java              Java              Node.js 20                      ║
║  FW: Spring Boot  Spring Boot       Spring Boot        NestJS 10.x                    ║
║  동시접속: ~400    ~1,000            1,000(실측)         측정 예정                       ║
║  방당: ~200       ~200              500+               측정 예정                        ║
║  이미지: ~400MB   ~400MB            ~400MB              ~150MB                          ║
║  메모리: ~300MB   ~300MB            ~300MB              ~50MB                           ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

### Docker Compose 서비스 구성 (Phase 3 기준)

```
┌─────────────────────────────────────────────────────────────────┐
│                Docker Compose — 프로필별 서비스 구성              │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   서비스      │ default      │ scale        │ test / load       │
├──────────────┼──────────────┼──────────────┼────────────────────┤
│ mysql        │ ✅ (:3307)   │ ✅ (:3307)   │ ✅ (:3307)        │
│ mongodb      │ ✅ (:27017)  │ ✅ (:27017)  │ ✅ (:27017)       │
│ redis        │ ✅ (:6379)   │ ✅ (:6379)   │ ✅ (:6379)        │
│ rabbitmq     │ —            │ ✅ (:61613)  │ —                 │
│ nginx        │ —            │ ✅ (:8888)   │ —                 │
│ chat-server  │ ✅ ×1 (:8080)│ ✅ ×2        │ ✅ ×1             │
│ api-server   │ ✅ (:8081)   │ ✅ (:8081)   │ ✅ (:8081)        │
│ client       │ ✅ (:3000)   │ ✅ ×2        │ —                 │
├──────────────┼──────────────┴──────────────┴────────────────────┤
│ Volumes      │ mysql_data, mongo_data, upload_data (공유 볼륨)   │
└──────────────┴──────────────────────────────────────────────────┘
```

### 성능 지표 비교

```
┌──────────────────────────┬──────────┬──────────┬──────────────┬──────────────────┐
│ 지표                      │ Phase 1  │ Phase 2  │ Phase 3      │ Phase 4          │
│                          │ (Java)   │ (Java)   │ (Java)       │ (NestJS)         │
├──────────────────────────┼──────────┼──────────┼──────────────┼──────────────────┤
│ 동시 접속자               │ ~400     │ ~1,000   │ 1,000 (실측) │ 측정 예정         │
│ 방당 최대 사용자           │ ~200     │ ~200     │ 500+         │ 측정 예정         │
│ 방 목록 조회 쿼리 수       │ 302      │ 3~4     │ 3~4          │ 3~4              │
│ 메시지 조회 P99 지연       │ —        │ 7.04ms   │ <10ms        │ 측정 예정         │
│ 메시지 처리량              │ —        │ 450/s    │ 308/s (발행) │ 측정 예정         │
│ STOMP 메시지 수신량        │ —        │ —        │ 7,060/s      │ 측정 예정         │
│ HTTP 실패율 (k6)          │ 0% (500) │ 0%(1000) │ 0% (1000)    │ 0% 목표          │
│ WebSocket 성공률           │ —        │ 100%     │ 94.3%(1000)  │ ≥95% 목표        │
│ 서버 인스턴스 수           │ 1        │ 2        │ N (수평 확장) │ N (수평 확장)     │
│ 이미지 저장 방식           │ Base64   │ Base64   │ 로컬 FS      │ 로컬 FS          │
│ 메시지 브로커              │ 인메모리 │ 인메모리 │ RabbitMQ     │ RabbitMQ         │
│ Docker 이미지 크기         │ ~400MB   │ ~400MB   │ ~400MB       │ ~150MB           │
│ 서버 메모리 (idle)         │ ~300MB   │ ~300MB   │ ~300MB       │ ~50MB            │
│ 백엔드 언어 / 프레임워크   │ Java/    │ Java/    │ Java/        │ Node.js/         │
│                          │ Spring   │ Spring   │ Spring       │ NestJS           │
│ 테스트 프레임워크          │ JUnit 5  │ JUnit 5  │ JUnit 5      │ Jest             │
└──────────────────────────┴──────────┴──────────┴──────────────┴──────────────────┘
```

#### Phase 3 부하테스트 실측치 (k6, Java/Spring Boot 기준)

| 테스트 시나리오 | VU | 총 요청 수 | HTTP P95 지연 | 실패율 | 비고 |
|--------------|-----|----------|-------------|-------|------|
| STOMP + RabbitMQ | 1,000 | 30,870 | 3,639ms | 0% | WS 성공률 94.3%, STOMP 수신 1,593K건 |
| 다중 인스턴스 LB | 1,500 | 142,781 | 8,245ms | 48.1% | 1,500VU에서 한계 도달 |

> Phase 4 부하테스트는 NestJS 마이그레이션 완료 후 동일 k6 시나리오로 실행하여 Java vs Node.js 성능 비교 예정.

### RabbitMQ 엔드포인트 (Phase 3+, Scale 모드)

| 포트 | 프로토콜 | 용도 | 비고 |
|------|---------|------|------|
| 61613 | STOMP | STOMP Broker Relay 연결 | chat-server ×N 인스턴스가 이 포트로 Relay |
| 5672 | AMQP | 내부 메시지 큐 관리 | RabbitMQ 네이티브 프로토콜 |
| 15672 | HTTP | Management UI | `guest/guest` (로컬 환경) |

```
chat-server (NestJS) → RabbitMQ (:61613 STOMP)
  ├── SUBSCRIBE /topic/chatroom.{roomId}         ← 구독 Relay
  ├── SUBSCRIBE /topic/chatroom.{roomId}.read-status
  └── SEND /app/chat.message, /app/chat.read     ← 발행 Relay
      ↕ RabbitMQ가 모든 chat-server 인스턴스에 메시지 팬아웃
```

---

> **문서 버전:** v2.0
> **최종 수정:** 2026-03-05
> **참조:** [SDD 명세](sdd-specification.md) · [Phase 2 회고](phase2-retrospective.md) · [Phase 3 로드맵](phase3-roadmap.md) · [Phase 4 마이그레이션 설계](../openspec/changes/phase4-nestjs-migration/design.md)
