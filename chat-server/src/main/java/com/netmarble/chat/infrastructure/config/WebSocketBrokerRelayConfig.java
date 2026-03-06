package com.netmarble.chat.infrastructure.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * RabbitMQ STOMP Relay 기반 WebSocket 설정 (scale 프로파일)
 * 외부 RabbitMQ 브로커를 통해 다중 chat-server 인스턴스 간 메시지를 동기화한다.
 */
@Configuration
@EnableWebSocketMessageBroker
@Profile("scale")
public class WebSocketBrokerRelayConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${rabbitmq.stomp.host}")
    private String relayHost;

    @Value("${rabbitmq.stomp.port}")
    private int relayPort;

    @Value("${rabbitmq.stomp.login}")
    private String relayLogin;

    @Value("${rabbitmq.stomp.passcode}")
    private String relayPasscode;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableStompBrokerRelay("/topic", "/queue")
                .setRelayHost(relayHost)
                .setRelayPort(relayPort)
                .setClientLogin(relayLogin)
                .setClientPasscode(relayPasscode)
                .setSystemLogin(relayLogin)
                .setSystemPasscode(relayPasscode);
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
