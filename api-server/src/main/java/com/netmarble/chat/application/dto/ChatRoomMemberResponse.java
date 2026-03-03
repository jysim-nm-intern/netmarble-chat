package com.netmarble.chat.application.dto;

import com.netmarble.chat.domain.model.ChatRoomMember;
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
    private Long lastReadMessageId; // 마지막으로 읽은 메시지 ID

    /**
     * Domain Entity로부터 DTO 생성
     */
    public static ChatRoomMemberResponse from(ChatRoomMember member) {
        return ChatRoomMemberResponse.builder()
            .id(member.getId())
            .userId(member.getUser().getId())
            .nickname(member.getUser().getNickname())
            .profileColor(member.getUser().getProfileColor())
            .profileImage(member.getUser().getProfileImage())
            .joinedAt(member.getJoinedAt())
            .leftAt(member.getLeftAt())
            .active(member.isActive())
            .lastReadMessageId(member.getLastReadMessage() != null ? member.getLastReadMessage().getId() : null)
            .build();
    }
}
