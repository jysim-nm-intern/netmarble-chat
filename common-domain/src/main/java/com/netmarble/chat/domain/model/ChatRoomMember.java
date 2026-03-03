package com.netmarble.chat.domain.model;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 채팅방 멤버 도메인 모델 (순수 POJO - 인프라 의존 없음)
 */
@Getter
@NoArgsConstructor
public class ChatRoomMember {

    private Long id;
    private Long chatRoomId;
    private Long userId;
    private LocalDateTime joinedAt;
    private LocalDateTime leftAt;
    private boolean active;
    private boolean online;
    private LocalDateTime lastActiveAt;
    private Long lastReadMessageId;

    public ChatRoomMember(Long chatRoomId, Long userId) {
        this.chatRoomId = chatRoomId;
        this.userId = userId;
        this.joinedAt = LocalDateTime.now();
        this.active = true;
        this.online = true;
        this.lastActiveAt = LocalDateTime.now();
    }

    public ChatRoomMember(Long id, Long chatRoomId, Long userId, LocalDateTime joinedAt,
                          LocalDateTime leftAt, boolean active, boolean online,
                          LocalDateTime lastActiveAt, Long lastReadMessageId) {
        this.id = id;
        this.chatRoomId = chatRoomId;
        this.userId = userId;
        this.joinedAt = joinedAt;
        this.leftAt = leftAt;
        this.active = active;
        this.online = online;
        this.lastActiveAt = lastActiveAt;
        this.lastReadMessageId = lastReadMessageId;
    }

    public void leave() {
        this.active = false;
        this.online = false;
        this.leftAt = LocalDateTime.now();
    }

    public void rejoin() {
        this.active = true;
        this.online = true;
        this.joinedAt = LocalDateTime.now();
        this.leftAt = null;
    }

    public void updateOnlineStatus(boolean online) {
        this.online = online;
        this.lastActiveAt = LocalDateTime.now();
    }

    public void updateLastReadMessage(Long messageId) {
        this.lastReadMessageId = messageId;
    }
}
