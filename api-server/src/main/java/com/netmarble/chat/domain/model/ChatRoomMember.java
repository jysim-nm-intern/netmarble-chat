package com.netmarble.chat.domain.model;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_room_members",
        indexes = {
                @Index(name = "idx_crm_room_id",      columnList = "chat_room_id"),
                @Index(name = "idx_crm_user_id",      columnList = "user_id"),
                @Index(name = "idx_crm_room_user",    columnList = "chat_room_id, user_id"),
                @Index(name = "idx_crm_room_active",  columnList = "chat_room_id, active")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatRoomMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_room_id", nullable = false)
    private ChatRoom chatRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private LocalDateTime joinedAt;

    @Column
    private LocalDateTime leftAt;

    @Column(nullable = false)
    private boolean active;
    
    @Column(nullable = false)
    private boolean online; // 현재 채팅방 화면에 있는지 여부
    
    @Column(nullable = false)
    private LocalDateTime lastActiveAt; // 마지막 활동 시간
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_read_message_id")
    private Message lastReadMessage; // 마지막으로 읽은 메시지

    // 생성자
    public ChatRoomMember(ChatRoom chatRoom, User user) {
        this.chatRoom = chatRoom;
        this.user = user;
        this.joinedAt = LocalDateTime.now();
        this.active = true;
        this.online = true;
        this.lastActiveAt = LocalDateTime.now();
    }

    // 도메인 로직: 채팅방 퇴장
    public void leave() {
        if (!this.active) {
            throw new IllegalStateException("이미 퇴장한 상태입니다.");
        }
        this.active = false;
        this.leftAt = LocalDateTime.now();
    }

    // 도메인 로직: 재입장
    public void rejoin() {
        if (this.active) {
            throw new IllegalStateException("이미 활성 상태입니다.");
        }
        this.active = true;
        this.online = true;
        this.joinedAt = LocalDateTime.now();
        this.leftAt = null;
        this.lastActiveAt = LocalDateTime.now();
    }
    
    // 도메인 로직: 활성 상태 업데이트
    public void updateActiveStatus(boolean online) {
        this.online = online;
        if (online) {
            this.lastActiveAt = LocalDateTime.now();
        }
    }
    
    // 도메인 로직: 활동 시간 업데이트
    public void updateActivity() {
        this.lastActiveAt = LocalDateTime.now();
        if (!this.online) {
            this.online = true;
        }
    }
    
    // 도메인 로직: 최근 활성 상태 확인 (30초 이내 활동)
    public boolean isRecentlyActive() {
        if (!this.active || !this.online) {
            return false;
        }
        return LocalDateTime.now().minusSeconds(3).isBefore(this.lastActiveAt);
    }
    
    // 도메인 로직: 마지막 읽은 메시지 업데이트
    public void updateLastReadMessage(Message message) {
        if (message == null) {
            return;
        }
        
        // 같은 채팅방의 메시지인지 확인
        if (!message.getChatRoom().getId().equals(this.chatRoom.getId())) {
            throw new IllegalArgumentException("다른 채팅방의 메시지입니다.");
        }
        
        // 더 최신 메시지로만 업데이트
        if (this.lastReadMessage == null || 
            message.getSentAt().isAfter(this.lastReadMessage.getSentAt())) {
            this.lastReadMessage = message;
            this.lastActiveAt = LocalDateTime.now();
        }
    }
    
    // 도메인 로직: 메시지 읽음 여부 확인
    public boolean hasReadMessage(Message message) {
        if (this.lastReadMessage == null) {
            return false;
        }
        // 마지막으로 읽은 메시지 ID가 현재 메시지 ID보다 크거나 같으면 읽음
        return this.lastReadMessage.getId() >= message.getId();
    }
}
