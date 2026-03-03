package com.netmarble.chat.infrastructure.config;

import com.netmarble.chat.infrastructure.interceptor.StompAuthChannelInterceptor;
import com.netmarble.chat.infrastructure.interceptor.WebSocketHandshakeInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketHandshakeInterceptor webSocketHandshakeInterceptor;
    private final StompAuthChannelInterceptor stompAuthChannelInterceptor;

    @Override
    public void configureMessageBroker(@NonNull MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(@NonNull StompEndpointRegistry registry) {
        // 브라우저용 SockJS 엔드포인트 — 세션 검증 인터셉터 등록
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("http://localhost:5173", "http://localhost:3000")
                .addInterceptors(webSocketHandshakeInterceptor)
                .withSockJS();

        // 네이티브 WebSocket 엔드포인트 (k6 등 SockJS 미지원 클라이언트용)
        registry.addEndpoint("/ws-stomp")
                .setAllowedOriginPatterns("http://localhost:5173", "http://localhost:3000")
                .addInterceptors(webSocketHandshakeInterceptor);
    }

    /**
     * STOMP 인바운드 채널에 인증 인터셉터 등록
     * CONNECT 시 auth 검증, SEND 시 senderId를 세션 userId로 교체
     */
    @Override
    public void configureClientInboundChannel(@NonNull ChannelRegistration registration) {
        registration.interceptors(stompAuthChannelInterceptor);
    }
}
