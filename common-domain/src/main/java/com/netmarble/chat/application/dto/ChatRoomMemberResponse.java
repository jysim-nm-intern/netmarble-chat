package com.netmarble.chat.application.dto;

import com.netmarble.chat.domain.model.ChatRoomMember;
import com.netmarble.chat.domain.model.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * 채팅방 멤버 응답 DTO
 */
@Getter
@Builder
@AllArgsConstructor
public class ChatRoomMemberResponse {

    private Long id;
    private Long userId;
    private String nickname;
    private String profileColor;
    private String profileImage;
    private LocalDateTime joinedAt;
    private LocalDateTime leftAt;
    private boolean active;
    private Long lastReadMessageId;

    public static ChatRoomMemberResponse from(ChatRoomMember member, User user) {
        return ChatRoomMemberResponse.builder()
            .id(member.getId())
            .userId(member.getUserId())
            .nickname(user != null ? user.getNickname() : null)
            .profileColor(user != null ? user.getProfileColor() : null)
            .profileImage(user != null ? user.getProfileImage() : null)
            .joinedAt(member.getJoinedAt())
            .leftAt(member.getLeftAt())
            .active(member.isActive())
            .lastReadMessageId(member.getLastReadMessageId())
            .build();
    }
}
