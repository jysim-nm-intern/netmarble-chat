package com.netmarble.chat.infrastructure.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * SimpleBroker 기반 WebSocket 설정 (scale 프로파일이 아닌 환경에서 활성화)
 * RabbitMQ 없이 JVM 내 메모리로 STOMP 메시지를 라우팅한다.
 */
@Configuration
@EnableWebSocketMessageBroker
@Profile("!scale")
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 브라우저용 SockJS 엔드포인트
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();

        // 네이티브 WebSocket 엔드포인트 (k6 등 SockJS 미지원 클라이언트용)
        registry.addEndpoint("/ws-stomp")
                .setAllowedOriginPatterns("*");
    }
}
