package com.netmarble.chat.application.dto;

import com.netmarble.chat.domain.model.ChatRoom;
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
    /** 활성 멤버 최대 4명의 아바타 정보 (프로필 색상 + 이미지) */
    private List<MemberAvatar> memberAvatars;

    /**
     * 멤버 아바타 정보 (채팅방 목록 썸네일 그룹용)
     */
    @Getter
    @AllArgsConstructor
    public static class MemberAvatar {
        private String profileColor;
        private String profileImage;
        private String nickname;
    }

    /**
     * Domain Entity로부터 DTO 생성 (목록/상세 기본값 — memberAvatars 미포함)
     */
    public static ChatRoomResponse from(ChatRoom chatRoom) {
        return ChatRoomResponse.builder()
            .id(chatRoom.getId())
            .name(chatRoom.getName())
            .imageUrl(chatRoom.getImageUrl())
            .creatorId(chatRoom.getCreator().getId())
            .creatorNickname(chatRoom.getCreator().getNickname())
            .createdAt(chatRoom.getCreatedAt())
            .active(chatRoom.isActive())
            .memberCount(chatRoom.getActiveMemberCount())
            .build();
    }
}
