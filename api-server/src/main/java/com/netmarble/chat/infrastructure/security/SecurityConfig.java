package com.netmarble.chat.infrastructure.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Spring Security 설정 — Stateless JWT 기반 인증
 *
 * - SessionCreationPolicy.STATELESS: HTTP 세션 완전 제거
 * - JWT 필터가 매 요청 Authorization 헤더를 검증
 * - /api/auth/** 는 인증 없이 접근 허용
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtTokenProvider jwtTokenProvider;
    private final RedisTemplate<String, String> redisTemplate;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // 인증 없이 접근 허용
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/users").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                // WebSocket 핸드셰이크
                .requestMatchers("/ws/**", "/stomp/**").permitAll()
                // H2 콘솔 (개발 환경)
                .requestMatchers("/h2-console/**").permitAll()
                // 나머지는 인증 필요 (현재 개발 단계 — 추후 활성화)
                .anyRequest().permitAll()
            )
            .addFilterBefore(
                new JwtAuthenticationFilter(jwtTokenProvider, redisTemplate),
                UsernamePasswordAuthenticationFilter.class
            )
            .headers(headers -> headers
                .frameOptions(frameOptions -> frameOptions.sameOrigin())
            )
            .build();
    }
}
