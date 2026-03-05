package com.netmarble.chat.domain.model;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String nickname;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime lastActiveAt;

    @Column(nullable = false)
    private boolean active;

    @Column(length = 20)
    private String profileColor;

    /** 프로필 이미지 (Base64 Data URL). null이면 profileColor 기반 아바타를 사용한다. */
    @Column(columnDefinition = "MEDIUMTEXT")
    private String profileImage;

    // 비즈니스 로직을 위한 생성자
    public User(String nickname) {
        this(nickname, null, null);
    }

    public User(String nickname, String profileColor) {
        this(nickname, profileColor, null);
    }

    public User(String nickname, String profileColor, String profileImage) {
        validateNickname(nickname);
        this.nickname = nickname;
        this.profileColor = (profileColor != null && !profileColor.isBlank()) ? profileColor : "#4f85c8";
        this.profileImage = profileImage;
        this.createdAt = LocalDateTime.now();
        this.lastActiveAt = LocalDateTime.now();
        this.active = true;
    }

    // 도메인 로직: 닉네임 유효성 검증
    private void validateNickname(String nickname) {
        if (nickname == null || nickname.trim().isEmpty()) {
            throw new IllegalArgumentException("닉네임은 비어있을 수 없습니다.");
        }
        if (nickname.length() < 2 || nickname.length() > 50) {
            throw new IllegalArgumentException("닉네임은 2자 이상 50자 이하여야 합니다.");
        }
        if (!nickname.matches("^[a-zA-Z0-9가-힣_]+$")) {
            throw new IllegalArgumentException("닉네임은 영문, 숫자, 한글, 언더스코어만 사용할 수 있습니다.");
        }
    }

    // 도메인 로직: 프로필 색상 업데이트
    public void updateProfileColor(String profileColor) {
        if (profileColor != null && !profileColor.isBlank()) {
            this.profileColor = profileColor;
        }
    }

    // 도메인 로직: 프로필 이미지 업데이트 (null 허용 - 이미지 제거)
    public void updateProfileImage(String profileImage) {
        this.profileImage = profileImage;
    }

    // 도메인 로직: 활동 시간 업데이트
    public void updateLastActive() {
        this.lastActiveAt = LocalDateTime.now();
    }

    // 도메인 로직: 비활성화
    public void deactivate() {
        this.active = false;
    }

    // 도메인 로직: 활성화
    public void activate() {
        this.active = true;
        updateLastActive();
    }
}
