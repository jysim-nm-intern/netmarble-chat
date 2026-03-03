package com.netmarble.chat.infrastructure.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * STOMP WebSocket 핸드셰이크 시 JWT 검증 인터셉터
 *
 * WebSocket 연결 시 Authorization 헤더 또는 쿼리 파라미터의 JWT를 검증.
 * 유효하지 않은 JWT → HTTP 401 반환 후 연결 거부.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String token = extractToken(request);

        if (!StringUtils.hasText(token)) {
            log.debug("[WS] JWT 없이 핸드셰이크 시도 (개발 모드 허용)");
            return true;
        }

        if (!jwtTokenProvider.validateToken(token)) {
            log.warn("[WS] 유효하지 않은 JWT로 WebSocket 연결 시도");
            return false;
        }

        Long userId = jwtTokenProvider.getUserId(token);
        String nickname = jwtTokenProvider.getNickname(token);
        attributes.put("userId", userId);
        attributes.put("nickname", nickname);

        log.debug("[WS] 핸드셰이크 인증 완료: userId={}, nickname={}", userId, nickname);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
    }

    private String extractToken(ServerHttpRequest request) {
        // Authorization 헤더 우선
        String header = request.getHeaders().getFirst("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7);
        }

        // 쿼리 파라미터 fallback (?token=xxx)
        if (request instanceof ServletServerHttpRequest servletRequest) {
            String queryToken = servletRequest.getServletRequest().getParameter("token");
            if (StringUtils.hasText(queryToken)) {
                return queryToken;
            }
        }

        return null;
    }
}
