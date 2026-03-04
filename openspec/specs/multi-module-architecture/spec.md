## ADDED Requirements

### Requirement: Gradle 멀티모듈 구조 정의
시스템은 단일 `server/` 모듈을 `common-domain`, `api-server`, `chat-server` 세 개의 Gradle 서브모듈로 분리해야(SHALL) 한다.

**모듈 역할:**

| 모듈 | 역할 | 의존 모듈 |
|------|------|-----------|
| `common-domain` | 도메인 모델(POJO), 서비스 인터페이스, DTO, 예외 클래스 | 없음 (순수 Java) |
| `api-server` | REST API 컨트롤러, WebSocket STOMP 엔드포인트, 인증 처리 | `common-domain` |
| `chat-server` | 실시간 메시지 처리, 읽음 상태 집계, STOMP 구독 핸들러 | `common-domain` |

**루트 `settings.gradle`:**
```groovy
rootProject.name = 'netmarble-chat'
include 'common-domain', 'api-server', 'chat-server'
```

#### Scenario: common-domain 모듈 빌드 독립성
- **WHEN** `common-domain` 모듈만 단독으로 빌드할 때
- **THEN** Spring Boot, JPA, MongoDB 등 인프라 의존성 없이 컴파일이 성공해야 한다

#### Scenario: api-server와 chat-server 간 직접 의존 금지
- **WHEN** `api-server`의 소스에서 `chat-server` 내부 클래스를 직접 import하면
- **THEN** Gradle 빌드가 컴파일 오류로 실패해야 한다

#### Scenario: 전체 프로젝트 빌드
- **WHEN** 루트 디렉토리에서 `./gradlew build`를 실행하면
- **THEN** 세 모듈 모두 순서대로(common-domain → api-server, chat-server) 빌드되어야 한다

---

### Requirement: 모듈 간 의존성 방향 규칙
시스템의 모든 코드는 `common-domain` 방향으로만 의존해야(SHALL) 한다. 역방향 의존 또는 순환 의존은 허용되지 않는다.

**허용 의존성:**
- `api-server` → `common-domain` (O)
- `chat-server` → `common-domain` (O)

**금지 의존성:**
- `common-domain` → `api-server` (X)
- `common-domain` → `chat-server` (X)
- `api-server` → `chat-server` (X — 모듈 간 통신은 이벤트 또는 REST 경유)
- `chat-server` → `api-server` (X)

#### Scenario: 역방향 의존 감지
- **WHEN** `common-domain`의 클래스가 `api-server` 패키지를 import하면
- **THEN** Gradle 빌드 또는 아키텍처 테스트(ArchUnit)가 실패해야 한다

---

### Requirement: 공유 도메인 엔티티 관리 규칙
`common-domain` 모듈에 정의된 도메인 모델은 인프라 기술에 독립적인 순수 Java 객체(POJO)여야(SHALL) 한다.

**규칙:**
- `@Entity`, `@Document` 등 인프라 어노테이션은 `common-domain`에 포함하지 않는다
- 영속성 매핑은 `api-server` 또는 `chat-server` 내부의 인프라 레이어에서 별도 클래스로 정의한다
- DTO는 `common-domain`에 포함 가능하나 직렬화 라이브러리 어노테이션(`@JsonProperty` 등)은 최소화한다

**패키지 구조 예시:**
```
common-domain/src/main/java/com/netmarble/chat/
├── domain/
│   ├── Room.java          # 순수 도메인 객체
│   ├── Message.java
│   └── User.java
├── service/
│   ├── MessageService.java   # 인터페이스
│   └── RoomService.java
└── dto/
    ├── MessageDto.java
    └── RoomDto.java

api-server/src/main/java/com/netmarble/chat/
└── infrastructure/
    ├── jpa/
    │   └── RoomJpaEntity.java    # @Entity (JPA 매핑 전용)
    └── mongo/
        └── MessageDocument.java  # @Document (MongoDB 매핑 전용)
```

#### Scenario: 도메인 객체 인프라 독립성 검증
- **WHEN** `common-domain`의 도메인 클래스가 컴파일될 때
- **THEN** `jakarta.persistence`, `org.springframework.data.mongodb` 등 인프라 패키지에 의존하지 않아야 한다

#### Scenario: 인프라 매핑 클래스 위치
- **WHEN** JPA `@Entity` 또는 MongoDB `@Document` 어노테이션이 필요할 때
- **THEN** 해당 클래스는 반드시 `api-server` 또는 `chat-server`의 `infrastructure` 패키지 내에 위치해야 한다

---

### Requirement: 모듈 독립 배포 준비
각 서버 모듈(`api-server`, `chat-server`)은 독립적으로 실행 가능한 Spring Boot 실행 가능 JAR로 패키징되어야(SHALL) 한다.

#### Scenario: api-server 독립 실행
- **WHEN** `java -jar api-server/build/libs/api-server.jar`를 실행하면
- **THEN** `api-server`가 정상 구동되어야 하며 `chat-server` JAR 없이도 REST API에 응답해야 한다

#### Scenario: chat-server 독립 실행
- **WHEN** `java -jar chat-server/build/libs/chat-server.jar`를 실행하면
- **THEN** `chat-server`가 정상 구동되어야 하며 STOMP 메시지 처리를 수행해야 한다
