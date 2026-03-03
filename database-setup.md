# Netmarble Chat - MySQL 데이터베이스 설정 가이드

## 1. MySQL 설치 확인

```bash
# MySQL 버전 확인
mysql --version

# MySQL 서비스 상태 확인 (macOS)
brew services list | grep mysql

# MySQL 서비스 시작 (macOS)
brew services start mysql
```

## 2. 데이터베이스 생성

### 방법 1: MySQL CLI 사용

```bash
# MySQL 접속
mysql -u root -p

# 데이터베이스 생성 및 테이블 생성
source /Users/simzard/projects/netmarble-chat/server/src/main/resources/schema.sql

# 또는 직접 실행
mysql -u root -p < /Users/simzard/projects/netmarble-chat/server/src/main/resources/schema.sql
```

### 방법 2: MySQL CLI에서 직접 입력

```sql
-- 1. MySQL 접속
mysql -u root -p

-- 2. 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS netmarble_chat 
    DEFAULT CHARACTER SET utf8mb4 
    DEFAULT COLLATE utf8mb4_unicode_ci;

-- 3. 데이터베이스 선택
USE netmarble_chat;

-- 4. schema.sql 파일 실행
source /Users/simzard/projects/netmarble-chat/server/src/main/resources/schema.sql
```

### 방법 3: Spring Boot 자동 생성 사용

Spring Boot의 `spring.jpa.hibernate.ddl-auto=update` 설정으로 자동으로 테이블이 생성됩니다.

```bash
# 1. 데이터베이스만 먼저 생성
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS netmarble_chat DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci;"

# 2. Spring Boot 애플리케이션 실행
cd /Users/simzard/projects/netmarble-chat/server
mvn spring-boot:run
```

## 3. 데이터베이스 확인

```sql
-- 데이터베이스 목록 확인
SHOW DATABASES;

-- netmarble_chat 데이터베이스 선택
USE netmarble_chat;

-- 테이블 목록 확인
SHOW TABLES;

-- 테이블 구조 확인
DESCRIBE users;
DESCRIBE chat_rooms;
DESCRIBE chat_room_members;
DESCRIBE messages;
DESCRIBE read_status;

-- 데이터 확인
SELECT * FROM users;
SELECT * FROM chat_rooms;
```

## 4. 테이블 구조

### 4.1 users (사용자)
- id: 사용자 고유 ID (PK)
- nickname: 닉네임 (UNIQUE, 2-50자)
- created_at: 생성 시간
- last_active_at: 마지막 활동 시간
- active: 활성 상태

### 4.2 chat_rooms (채팅방)
- id: 채팅방 고유 ID (PK)
- name: 채팅방 이름 (2-100자)
- description: 채팅방 설명
- creator_id: 생성자 ID (FK -> users)
- created_at: 생성 시간
- active: 활성 상태

### 4.3 chat_room_members (채팅방 멤버)
- id: 멤버 고유 ID (PK)
- chat_room_id: 채팅방 ID (FK -> chat_rooms)
- user_id: 사용자 ID (FK -> users)
- joined_at: 입장 시간
- left_at: 퇴장 시간
- active: 활성 상태

### 4.4 messages (메시지)
- id: 메시지 고유 ID (PK)
- chat_room_id: 채팅방 ID (FK -> chat_rooms)
- sender_id: 발신자 ID (FK -> users, nullable for system messages)
- content: 메시지 내용 (TEXT)
- type: 메시지 타입 (TEXT, IMAGE, STICKER, SYSTEM)
- sent_at: 전송 시간
- deleted: 삭제 여부

### 4.5 read_status (읽음 상태)
- id: 읽음 상태 고유 ID (PK)
- user_id: 사용자 ID (FK -> users)
- chat_room_id: 채팅방 ID (FK -> chat_rooms)
- last_read_message_id: 마지막으로 읽은 메시지 ID (FK -> messages)
- last_read_at: 마지막 읽음 시간
- UNIQUE (user_id, chat_room_id)

## 5. 연결 정보

- **Host**: localhost
- **Port**: 3306
- **Database**: netmarble_chat
- **Username**: root
- **Password**: root (실제 비밀번호로 변경 필요)
- **Charset**: utf8mb4
- **Collation**: utf8mb4_unicode_ci

## 6. 문제 해결

### MySQL 접속 오류

```bash
# MySQL 서비스 재시작
brew services restart mysql

# 비밀번호 재설정 (필요시)
mysql -u root -p
ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;
```

### 테이블 재생성

```sql
-- 모든 테이블 삭제 (주의!)
DROP DATABASE IF EXISTS netmarble_chat;

-- 다시 생성
source /Users/simzard/projects/netmarble-chat/server/src/main/resources/schema.sql
```

## 7. 운영 환경 권장 설정

```sql
-- 전용 사용자 생성
CREATE USER 'netmarble_chat_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON netmarble_chat.* TO 'netmarble_chat_user'@'localhost';
FLUSH PRIVILEGES;
```

그리고 application.properties 수정:
```properties
spring.datasource.username=netmarble_chat_user
spring.datasource.password=secure_password
```
