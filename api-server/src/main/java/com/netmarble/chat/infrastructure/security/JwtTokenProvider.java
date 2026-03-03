package com.netmarble.chat.infrastructure.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.UUID;

/**
 * JWT AccessToken / RefreshToken 발급 및 검증
 *
 * 토큰 규격:
 *   AccessToken : 유효기간 15분, HS256, 페이로드 userId · nickname · roles
 *   RefreshToken: 유효기간 7일, Redis에 refresh:{userId} 키로 저장
 */
@Slf4j
@Component
public class JwtTokenProvider {

    private final SecretKey secretKey;
    private final long accessTokenExpiry;
    private final long refreshTokenExpiry;

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.access-token-expiry-ms:900000}") long accessTokenExpiry,
            @Value("${jwt.refresh-token-expiry-ms:604800000}") long refreshTokenExpiry) {
        this.secretKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(
            java.util.Base64.getEncoder().encodeToString(secret.getBytes())
        ));
        this.accessTokenExpiry = accessTokenExpiry;
        this.refreshTokenExpiry = refreshTokenExpiry;
    }

    /**
     * AccessToken 발급 (15분)
     */
    public String generateAccessToken(Long userId, String nickname) {
        Date now = new Date();
        return Jwts.builder()
            .id(UUID.randomUUID().toString())       // JTI — 블랙리스트용
            .subject(userId.toString())
            .claim("nickname", nickname)
            .claim("type", "ACCESS")
            .issuedAt(now)
            .expiration(new Date(now.getTime() + accessTokenExpiry))
            .signWith(secretKey)
            .compact();
    }

    /**
     * RefreshToken 발급 (7일)
     */
    public String generateRefreshToken(Long userId) {
        Date now = new Date();
        return Jwts.builder()
            .id(UUID.randomUUID().toString())
            .subject(userId.toString())
            .claim("type", "REFRESH")
            .issuedAt(now)
            .expiration(new Date(now.getTime() + refreshTokenExpiry))
            .signWith(secretKey)
            .compact();
    }

    /**
     * 토큰에서 userId 추출
     */
    public Long getUserId(String token) {
        return Long.parseLong(getClaims(token).getSubject());
    }

    /**
     * 토큰에서 nickname 추출
     */
    public String getNickname(String token) {
        return getClaims(token).get("nickname", String.class);
    }

    /**
     * JTI(JWT ID) 추출 — 로그아웃 블랙리스트 등록용
     */
    public String getJti(String token) {
        return getClaims(token).getId();
    }

    /**
     * 토큰 만료까지 남은 시간(ms) 계산
     */
    public long getRemainingExpiry(String token) {
        Date expiration = getClaims(token).getExpiration();
        return expiration.getTime() - System.currentTimeMillis();
    }

    /**
     * AccessToken 유효성 검증 (서명 + 만료 시간)
     */
    public boolean validateToken(String token) {
        try {
            getClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.debug("[JWT] 만료된 토큰: {}", e.getMessage());
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("[JWT] 유효하지 않은 토큰: {}", e.getMessage());
        }
        return false;
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
            .verifyWith(secretKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}
