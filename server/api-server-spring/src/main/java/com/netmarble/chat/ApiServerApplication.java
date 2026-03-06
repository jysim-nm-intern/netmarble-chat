package com.netmarble.chat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * API Server — REST API 전담 서버.
 *
 * 역할:
 *   - MongoDB: 메시지 이력 조회, cursor-based 페이징
 *   - MySQL: 채팅방/유저 조회 (chat-server와 공유 DB)
 */
@SpringBootApplication
public class ApiServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(ApiServerApplication.class, args);
    }
}
