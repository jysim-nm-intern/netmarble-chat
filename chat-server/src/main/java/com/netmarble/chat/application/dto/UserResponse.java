package com.netmarble.chat.application.dto;

import com.netmarble.chat.domain.model.User;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * 사용자 응답 DTO
 */
@Getter
@AllArgsConstructor
public class UserResponse {

    private Long id;
    private String nickname;
    private LocalDateTime createdAt;
    private LocalDateTime lastActiveAt;
    private boolean active;
    private String profileColor;
    private String profileImage;

    /**
     * Domain Entity로부터 DTO 생성
     */
    public static UserResponse from(User user) {
        return new UserResponse(
            user.getId(),
            user.getNickname(),
            user.getCreatedAt(),
            user.getLastActiveAt(),
            user.isActive(),
            user.getProfileColor(),
            user.getProfileImage()
        );
    }
}
