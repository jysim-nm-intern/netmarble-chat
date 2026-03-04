package com.netmarble.chat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.TimeZone;

/**
 * 실시간 채팅 처리 서버 (WebSocket STOMP + Redis)
 */
@SpringBootApplication
public class ChatServerApplication {

    public static void main(String[] args) {
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"));
        SpringApplication.run(ChatServerApplication.class, args);
    }
}
