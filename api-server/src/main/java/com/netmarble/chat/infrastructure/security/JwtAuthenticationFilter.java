package com.netmarble.chat.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

/**
 * JWT 인증 필터
 *
 * 요청당 1회 실행 (OncePerRequestFilter).
 * Authorization: Bearer {token} 헤더에서 JWT 추출 후:
 *   1. 서명 및 만료 검증 (JwtTokenProvider)
 *   2. Redis 블랙리스트 확인 (로그아웃 처리)
 *   3. SecurityContext에 인증 정보 설정
 */
@Slf4j
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BLACKLIST_PREFIX = "blacklist:";

    private final JwtTokenProvider jwtTokenProvider;
    private final RedisTemplate<String, String> redisTemplate;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = extractToken(request);

        if (StringUtils.hasText(token) && jwtTokenProvider.validateToken(token)) {
            String jti = jwtTokenProvider.getJti(token);

            // Redis 블랙리스트 확인 (로그아웃된 토큰)
            if (Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + jti))) {
                log.debug("[JWT] 블랙리스트에 등록된 토큰: jti={}", jti);
            } else {
                Long userId = jwtTokenProvider.getUserId(token);
                String nickname = jwtTokenProvider.getNickname(token);

                UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authentication);
                log.debug("[JWT] 인증 완료: userId={}, nickname={}", userId, nickname);
            }
        }

        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
