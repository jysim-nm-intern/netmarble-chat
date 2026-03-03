-- ========================================
-- Netmarble Chat Database Schema (MySQL)
-- ========================================

-- 데이터베이스 생성 (필요 시)
CREATE DATABASE IF NOT EXISTS netmarble_chat
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE netmarble_chat;

-- ========================================
-- 기존 테이블 초기화 (DROP DATABASE 권한 없어도 동작)
-- FK 의존성 역순으로 삭제
-- ========================================
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS chat_room_members;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS chat_rooms;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ========================================
-- 1. users 테이블
-- ========================================
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nickname VARCHAR(50) NOT NULL UNIQUE,
    profile_color VARCHAR(20) NOT NULL DEFAULT '#4f85c8',
    profile_image MEDIUMTEXT NULL COMMENT '프로필 이미지 (Base64 Data URL, 없으면 NULL)',
    created_at DATETIME(6) NOT NULL,
    last_active_at DATETIME(6) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    INDEX idx_nickname (nickname),
    INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='사용자 정보';

-- ========================================
-- 2. chat_rooms 테이블
-- ========================================
CREATE TABLE chat_rooms (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    image_url MEDIUMTEXT COMMENT '채팅방 썸네일 이미지 URL (Base64 또는 경로)',
    creator_id BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 COMMENT '낙관적 잠금 버전',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    INDEX idx_creator_id (creator_id),
    INDEX idx_active (active),
    INDEX idx_created_at (created_at),
    CONSTRAINT fk_chat_rooms_creator 
        FOREIGN KEY (creator_id) REFERENCES users(id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='채팅방 정보';

-- ========================================
-- 3. messages 테이블 (chat_room_members보다 먼저 생성 - FK 참조)
-- ========================================
CREATE TABLE messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    chat_room_id BIGINT NOT NULL,
    sender_id BIGINT,
    content TEXT NOT NULL,
    type ENUM('TEXT', 'IMAGE', 'STICKER', 'SYSTEM') NOT NULL,
    sent_at DATETIME(6) NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    INDEX idx_chat_room_id (chat_room_id),
    INDEX idx_sender_id (sender_id),
    INDEX idx_sent_at (sent_at),
    INDEX idx_chat_room_sent_at (chat_room_id, sent_at),
    CONSTRAINT fk_messages_chat_room 
        FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender 
        FOREIGN KEY (sender_id) REFERENCES users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='메시지 정보';

-- ========================================
-- 4. chat_room_members 테이블
-- ========================================
CREATE TABLE chat_room_members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    chat_room_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    joined_at DATETIME(6) NOT NULL,
    left_at DATETIME(6),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    online BOOLEAN NOT NULL DEFAULT TRUE COMMENT '현재 채팅방 화면에 있는지 여부',
    last_active_at DATETIME(6) NOT NULL COMMENT '마지막 활동 시간',
    last_read_message_id BIGINT COMMENT '마지막으로 읽은 메시지 ID',
    INDEX idx_chat_room_id (chat_room_id),
    INDEX idx_user_id (user_id),
    INDEX idx_active (active),
    INDEX idx_chat_room_user (chat_room_id, user_id),
    INDEX idx_chat_room_active (chat_room_id, active),
    INDEX idx_last_read_message (last_read_message_id),
    CONSTRAINT fk_chat_room_members_room 
        FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_chat_room_members_user 
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_chat_room_members_last_message
        FOREIGN KEY (last_read_message_id) REFERENCES messages(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='채팅방 멤버 정보 (마지막 읽은 메시지 포함)';

-- ========================================
-- 5. attachments 테이블 (SDD spec 기준)
-- ========================================
CREATE TABLE attachments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT NOT NULL,
    file_url MEDIUMTEXT NOT NULL COMMENT '파일 URL (이미지: 서버 경로, 스티커: 스티커 ID, 개발 단계: Base64)',
    file_type VARCHAR(50) NOT NULL COMMENT '파일 종류: IMAGE / STICKER',
    created_at DATETIME(6) NOT NULL,
    INDEX idx_message_id (message_id),
    CONSTRAINT fk_attachments_message
        FOREIGN KEY (message_id) REFERENCES messages(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='메시지 첨부파일 (이미지, 스티커)';

-- ========================================
-- 샘플 데이터 (선택사항)
-- ========================================

-- 샘플 사용자
-- INSERT INTO users (nickname, created_at, last_active_at, active) VALUES
-- ('홍길동', NOW(), NOW(), TRUE),
-- ('김철수', NOW(), NOW(), TRUE),
-- ('이영희', NOW(), NOW(), TRUE);

-- 샘플 채팅방
-- INSERT INTO chat_rooms (name, creator_id, created_at, active) VALUES
-- ('자유 채팅방', 1, NOW(), TRUE),
-- ('개발 토론방', 2, NOW(), TRUE);

-- 샘플 멤버
-- INSERT INTO chat_room_members (chat_room_id, user_id, joined_at, active) VALUES
-- (1, 1, NOW(), TRUE),
-- (1, 2, NOW(), TRUE),
-- (2, 2, NOW(), TRUE),
-- (2, 3, NOW(), TRUE);
