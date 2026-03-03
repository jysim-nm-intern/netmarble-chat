package com.netmarble.chat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 실시간 채팅 처리 서버 (WebSocket STOMP + Redis)
 * 읽음 상태 집계, STOMP 구독 핸들러 전담
 */
@SpringBootApplication
public class ChatServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(ChatServerApplication.class, args);
    }
}
