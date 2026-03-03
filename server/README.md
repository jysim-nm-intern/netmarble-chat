# Netmarble Chat Server

Spring Boot 3 기반의 실시간 채팅 서버 애플리케이션입니다.

## 기술 스택

- **Java 17**: 프로그래밍 언어
- **Spring Boot 3.2.1**: 애플리케이션 프레임워크
- **Spring WebSocket**: WebSocket 지원
- **Spring Data JPA**: 데이터 접근 계층
- **MySQL**: 프로덕션 데이터베이스
- **H2**: 개발용 인메모리 데이터베이스
- **Lombok**: 보일러플레이트 코드 감소
- **Gradle**: 빌드 도구

## 아키텍처

### DDD (Domain-Driven Design) 계층 구조

```
com.netmarble.chat/
├── domain/                    # 도메인 계층
│   ├── model/                # 도메인 엔티티
│   ├── repository/           # 리포지토리 인터페이스
│   └── service/              # 도메인 서비스
├── application/              # 애플리케이션 계층
│   └── service/              # 애플리케이션 서비스
├── infrastructure/           # 인프라 계층
│   ├── config/              # 설정 클래스
│   └── persistence/         # JPA 구현체
└── presentation/            # 프레젠테이션 계층
    └── controller/          # REST/WebSocket 컨트롤러
```

### 계층별 책임

- **Domain**: 비즈니스 로직과 규칙을 포함하는 핵심 계층
- **Application**: 유즈케이스를 조율하고 트랜잭션을 관리
- **Infrastructure**: 외부 시스템과의 통신 및 기술적 구현
- **Presentation**: API 엔드포인트 제공

## 환경 설정

### 1. 사전 요구사항

- JDK 17 이상
- Gradle 8.x (또는 프로젝트 내 Gradle Wrapper 사용)
- MySQL 8.0 이상 (프로덕션) 또는 H2 (개발)

### 2. 데이터베이스 설정

#### MySQL (프로덕션)

```sql
CREATE DATABASE chat_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'chatuser'@'localhost' IDENTIFIED BY 'chatpass';
GRANT ALL PRIVILEGES ON chat_db.* TO 'chatuser'@'localhost';
FLUSH PRIVILEGES;
```

`application.properties` 파일에서 데이터베이스 정보를 수정하세요.

#### H2 (개발)

개발 프로필을 사용하면 H2 인메모리 데이터베이스가 자동으로 설정됩니다:

```bash
./gradlew bootRun --args='--spring.profiles.active=dev'
```

H2 콘솔: `http://localhost:8080/h2-console`

### 3. 의존성 설치 및 빌드

```bash
cd server
./gradlew clean build
# Windows: gradlew.bat clean build
```

### 4. 애플리케이션 실행

#### 개발 모드 (H2)

```bash
./gradlew bootRun --args='--spring.profiles.active=dev'
```

#### DB 초기화 모드 (MySQL, drop/create)

```bash
./gradlew bootRun --args='--spring.profiles.active=reset'
```

#### 프로덕션 모드 (MySQL)

```bash
./gradlew bootRun
```

또는 JAR 파일 실행:

```bash
./gradlew clean bootJar
java -jar build/libs/chat-server-1.0.0.jar
```

서버는 `http://localhost:8080`에서 실행됩니다.

### 5. 상태 확인

```bash
curl http://localhost:8080/api/health
```

## WebSocket 엔드포인트

- **Connection**: `ws://localhost:8080/ws`
- **Subscribe**: `/topic/*`, `/queue/*`
- **Send**: `/app/*`

## 설정 파일

- `application.properties`: 기본 설정 (MySQL)
- `application-dev.properties`: 개발 환경 설정 (H2)

## 주요 기능 (예정)

- [ ] 사용자 관리
- [ ] 채팅방 생성/조회/삭제
- [ ] 실시간 메시지 송수신
- [ ] 메시지 영속성
- [ ] 파일 업로드 (이미지/스티커)
- [ ] 메시지 검색
- [ ] 읽음 처리

## 테스트

```bash
./gradlew test
```

## 로깅

로그 레벨은 `application.properties`에서 조정할 수 있습니다:

```properties
logging.level.com.netmarble.chat=DEBUG
```

## Infrastructure Independence

본 프로젝트는 인프라 독립성을 지향합니다:

- **Database Agnostic**: Repository 인터페이스를 통해 다양한 데이터베이스 지원
- **Messaging Decoupling**: 메시징 포트 추상화를 통해 Kafka, RabbitMQ 등으로 전환 가능
