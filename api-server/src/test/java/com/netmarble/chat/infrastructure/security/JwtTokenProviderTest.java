package com.netmarble.chat.infrastructure.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * JWT 토큰 제공자 단위 테스트 (Task 7.8)
 *
 * 검증 항목:
 *   - AccessToken 발급 및 유효성
 *   - RefreshToken 발급 및 유효성
 *   - userId, nickname, JTI 추출
 *   - 만료 시간 계산
 *   - 위조 토큰 검증 실패
 */
class JwtTokenProviderTest {

    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void setUp() {
        jwtTokenProvider = new JwtTokenProvider(
            "test-secret-key-for-unit-testing-only-must-be-long-enough",
            900_000L,       // 15분
            604_800_000L    // 7일
        );
    }

    @Test
    @DisplayName("AccessToken 발급 후 유효성 검증 성공")
    void generateAndValidateAccessToken() {
        String token = jwtTokenProvider.generateAccessToken(1L, "테스터");

        assertThat(jwtTokenProvider.validateToken(token)).isTrue();
    }

    @Test
    @DisplayName("AccessToken에서 userId, nickname 정확히 추출")
    void extractClaimsFromAccessToken() {
        Long userId = 42L;
        String nickname = "홍길동";

        String token = jwtTokenProvider.generateAccessToken(userId, nickname);

        assertThat(jwtTokenProvider.getUserId(token)).isEqualTo(userId);
        assertThat(jwtTokenProvider.getNickname(token)).isEqualTo(nickname);
    }

    @Test
    @DisplayName("AccessToken에서 JTI 추출 (블랙리스트 등록용)")
    void extractJtiFromToken() {
        String token = jwtTokenProvider.generateAccessToken(1L, "테스터");
        String jti = jwtTokenProvider.getJti(token);

        assertThat(jti).isNotNull().isNotBlank();
    }

    @Test
    @DisplayName("두 토큰의 JTI는 서로 다름 (UUID 기반)")
    void differentTokensHaveDifferentJti() {
        String token1 = jwtTokenProvider.generateAccessToken(1L, "테스터");
        String token2 = jwtTokenProvider.generateAccessToken(1L, "테스터");

        assertThat(jwtTokenProvider.getJti(token1))
            .isNotEqualTo(jwtTokenProvider.getJti(token2));
    }

    @Test
    @DisplayName("RefreshToken 발급 후 userId 추출")
    void generateAndExtractRefreshToken() {
        Long userId = 99L;
        String refreshToken = jwtTokenProvider.generateRefreshToken(userId);

        assertThat(jwtTokenProvider.validateToken(refreshToken)).isTrue();
        assertThat(jwtTokenProvider.getUserId(refreshToken)).isEqualTo(userId);
    }

    @Test
    @DisplayName("서명이 다른 위조 토큰은 검증 실패")
    void validateFakeToken_returnsFalse() {
        String fakeToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.fake_signature";

        assertThat(jwtTokenProvider.validateToken(fakeToken)).isFalse();
    }

    @Test
    @DisplayName("null 또는 빈 토큰은 검증 실패")
    void validateNullOrEmptyToken_returnsFalse() {
        assertThat(jwtTokenProvider.validateToken(null)).isFalse();
        assertThat(jwtTokenProvider.validateToken("")).isFalse();
        assertThat(jwtTokenProvider.validateToken("  ")).isFalse();
    }

    @Test
    @DisplayName("getRemainingExpiry — 만료까지 남은 시간이 0보다 큼")
    void getRemainingExpiry_positive() {
        String token = jwtTokenProvider.generateAccessToken(1L, "테스터");

        long remaining = jwtTokenProvider.getRemainingExpiry(token);

        assertThat(remaining).isPositive();
        assertThat(remaining).isLessThanOrEqualTo(900_000L);
    }
}
