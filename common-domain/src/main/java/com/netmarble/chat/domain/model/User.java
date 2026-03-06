package com.netmarble.chat.domain.model;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 사용자 도메인 모델 (순수 POJO - 인프라 의존 없음)
 */
@Getter
@NoArgsConstructor
public class User {

    private Long id;
    private String nickname;
    private LocalDateTime createdAt;
    private LocalDateTime lastActiveAt;
    private boolean active;
    private String profileColor;
    private String profileImage;

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

    public User(Long id, String nickname, String profileColor, String profileImage,
                LocalDateTime createdAt, LocalDateTime lastActiveAt, boolean active) {
        this.id = id;
        this.nickname = nickname;
        this.profileColor = profileColor;
        this.profileImage = profileImage;
        this.createdAt = createdAt;
        this.lastActiveAt = lastActiveAt;
        this.active = active;
    }

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

    public void updateProfileColor(String profileColor) {
        if (profileColor != null && !profileColor.isBlank()) {
            this.profileColor = profileColor;
        }
    }

    public void updateProfileImage(String profileImage) {
        this.profileImage = profileImage;
    }

    public void updateLastActive() {
        this.lastActiveAt = LocalDateTime.now();
    }

    public void deactivate() {
        this.active = false;
    }

    public void activate() {
        this.active = true;
        updateLastActive();
    }
}
