package com.netmarble.chat.presentation.controller.auth;

import com.netmarble.chat.infrastructure.security.JwtTokenProvider;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;

/**
 * JWT 인증 API
 *
 * POST /api/auth/login   — AccessToken + RefreshToken 발급
 * POST /api/auth/refresh — AccessToken 갱신
 * POST /api/auth/logout  — AccessToken 블랙리스트 등록
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String REFRESH_KEY_PREFIX = "refresh:";
    private static final String BLACKLIST_PREFIX = "blacklist:";

    private final JwtTokenProvider jwtTokenProvider;
    private final RedisTemplate<String, String> redisTemplate;

    /**
     * 로그인 — AccessToken + RefreshToken 발급
     * 현재는 userId, nickname을 직접 받는 단순 형태 (Phase 2 기반 구축용)
     */
    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@RequestBody LoginRequest request) {
        log.info("[Auth] 로그인: userId={}, nickname={}", request.getUserId(), request.getNickname());

        String accessToken = jwtTokenProvider.generateAccessToken(request.getUserId(), request.getNickname());
        String refreshToken = jwtTokenProvider.generateRefreshToken(request.getUserId());

        // RefreshToken을 Redis에 저장 (7일 TTL)
        redisTemplate.opsForValue().set(
            REFRESH_KEY_PREFIX + request.getUserId(),
            refreshToken,
            Duration.ofDays(7)
        );

        return ResponseEntity.ok(new TokenResponse(accessToken, refreshToken));
    }

    /**
     * AccessToken 갱신 — RefreshToken 검증 후 새 AccessToken 발급
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken == null || !jwtTokenProvider.validateToken(refreshToken)) {
            return ResponseEntity.status(401).body("유효하지 않은 RefreshToken");
        }

        Long userId = jwtTokenProvider.getUserId(refreshToken);
        String storedToken = redisTemplate.opsForValue().get(REFRESH_KEY_PREFIX + userId);

        if (!refreshToken.equals(storedToken)) {
            return ResponseEntity.status(401).body("RefreshToken이 일치하지 않습니다");
        }

        // 기존 닉네임은 새 AccessToken에서 페이로드로 가져올 수 없으므로 별도 조회 필요
        // 여기서는 userId만으로 새 토큰 발급 (nickname은 별도 사용자 조회로 처리)
        String newAccessToken = jwtTokenProvider.generateAccessToken(userId, "");
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(userId);

        // RefreshToken 갱신
        redisTemplate.opsForValue().set(
            REFRESH_KEY_PREFIX + userId,
            newRefreshToken,
            Duration.ofDays(7)
        );

        log.info("[Auth] AccessToken 갱신: userId={}", userId);
        return ResponseEntity.ok(new TokenResponse(newAccessToken, newRefreshToken));
    }

    /**
     * 로그아웃 — AccessToken JTI를 블랙리스트에 등록
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader("Authorization") String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.badRequest().build();
        }

        String token = authHeader.substring(7);
        if (!jwtTokenProvider.validateToken(token)) {
            return ResponseEntity.ok().build();
        }

        String jti = jwtTokenProvider.getJti(token);
        Long userId = jwtTokenProvider.getUserId(token);
        long remainingMs = jwtTokenProvider.getRemainingExpiry(token);

        // JTI를 블랙리스트에 등록 (남은 만료 시간만큼 TTL)
        if (remainingMs > 0) {
            redisTemplate.opsForValue().set(
                BLACKLIST_PREFIX + jti,
                "logout",
                Duration.ofMillis(remainingMs)
            );
        }

        // RefreshToken 삭제
        redisTemplate.delete(REFRESH_KEY_PREFIX + userId);

        log.info("[Auth] 로그아웃 처리 완료: userId={}, jti={}", userId, jti);
        return ResponseEntity.ok().build();
    }

    @Getter
    @RequiredArgsConstructor
    public static class LoginRequest {
        private final Long userId;
        private final String nickname;
    }

    @Getter
    @RequiredArgsConstructor
    public static class TokenResponse {
        private final String accessToken;
        private final String refreshToken;
    }
}
