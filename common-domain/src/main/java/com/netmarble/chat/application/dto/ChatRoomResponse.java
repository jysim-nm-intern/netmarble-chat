package com.netmarble.chat.application.dto;

import com.netmarble.chat.domain.model.ChatRoom;
import com.netmarble.chat.domain.model.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 채팅방 응답 DTO
 */
@Getter
@Builder
@AllArgsConstructor
public class ChatRoomResponse {

    private Long id;
    private String name;
    private String imageUrl;
    private Long creatorId;
    private String creatorNickname;
    private LocalDateTime createdAt;
    private boolean active;
    private long memberCount;
    private Long unreadCount;
    private Boolean isMember;
    private String lastMessageContent;
    private LocalDateTime lastMessageAt;
    private List<MemberAvatar> memberAvatars;

    @Getter
    @AllArgsConstructor
    public static class MemberAvatar {
        private String profileColor;
        private String profileImage;
        private String nickname;
    }

    public static ChatRoomResponse from(ChatRoom chatRoom, User creator) {
        return ChatRoomResponse.builder()
            .id(chatRoom.getId())
            .name(chatRoom.getName())
            .imageUrl(chatRoom.getImageUrl())
            .creatorId(chatRoom.getCreatorId())
            .creatorNickname(creator != null ? creator.getNickname() : null)
            .createdAt(chatRoom.getCreatedAt())
            .active(chatRoom.isActive())
            .memberCount(chatRoom.getActiveMemberCount())
            .build();
    }
}
