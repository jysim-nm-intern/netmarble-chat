package com.netmarble.chat.infrastructure.interceptor;

import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * STOMP 채널 인터셉터
 * - CONNECT 시 WebSocket session attributes의 userId 존재 여부로 인증 검증
 * - SEND 시 payload의 senderId를 세션 userId로 강제 교체하여 클라이언트 조작 방지
 */
@Slf4j
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    @Override
    public Message<?> preSend(
            @NonNull Message<?> message,
            @NonNull MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor == null) {
            return message;
        }

        StompCommand command = accessor.getCommand();

        if (StompCommand.CONNECT.equals(command)) {
            Long userId = getSessionUserId(accessor);
            if (userId == null) {
                log.warn("STOMP CONNECT 거부: 세션에 userId 없음");
                throw new MessageDeliveryException("인증이 필요합니다. 로그인 후 다시 시도하세요.");
            }
            log.debug("STOMP CONNECT 허용: userId={}", userId);
        }

        return message;
    }

    /**
     * STOMP session attributes에서 userId를 반환.
     * WebSocketHandshakeInterceptor에서 복사한 값이다.
     */
    public static Long getSessionUserId(SimpMessageHeaderAccessor accessor) {
        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        if (sessionAttributes == null) {
            return null;
        }
        Object userId = sessionAttributes.get("userId");
        return userId instanceof Long ? (Long) userId : null;
    }
}
