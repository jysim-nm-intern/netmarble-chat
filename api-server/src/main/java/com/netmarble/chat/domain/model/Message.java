package com.netmarble.chat.domain.model;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "messages")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_room_id", nullable = false)
    private ChatRoom chatRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = true)
    private User sender;

    // TEXT: 메시지 본문 / IMAGE: 파일명(alt text) / STICKER: "[스티커]" / SYSTEM: 알림 내용
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private MessageType type;

    @Column(nullable = false)
    private LocalDateTime sentAt;

    @Column(nullable = false)
    private boolean deleted;

    // 첨부파일 (IMAGE / STICKER 메시지에 존재)
    @OneToOne(mappedBy = "message", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private Attachment attachment;

    // 메시지 타입
    public enum MessageType {
        TEXT,       // 텍스트 메시지
        IMAGE,      // 이미지
        STICKER,    // 스티커
        SYSTEM      // 시스템 메시지 (입장, 퇴장 알림 등)
    }

    // 생성자 (TEXT / SYSTEM)
    public Message(ChatRoom chatRoom, User sender, String content, MessageType type) {
        validateContent(content, type);
        this.chatRoom = chatRoom;
        this.sender = sender;
        this.content = content;
        this.type = type;
        this.sentAt = LocalDateTime.now();
        this.deleted = false;
    }

    // 편의 생성자 (텍스트 메시지)
    public Message(ChatRoom chatRoom, User sender, String content) {
        this(chatRoom, sender, content, MessageType.TEXT);
    }

    // 도메인 로직: 내용 유효성 검증 (TEXT만 5000자 제한)
    private void validateContent(String content, MessageType type) {
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("메시지 내용은 비어있을 수 없습니다.");
        }
        if (type == MessageType.TEXT && content.length() > 5000) {
            throw new IllegalArgumentException("메시지는 5000자를 초과할 수 없습니다.");
        }
    }

    // 도메인 로직: 메시지 삭제 (소프트 삭제)
    public void delete() {
        this.deleted = true;
    }

    // 도메인 로직: 시스템 메시지 생성 (정적 팩토리 메서드)
    public static Message createSystemMessage(ChatRoom chatRoom, String content) {
        Message message = new Message();
        message.chatRoom = chatRoom;
        message.sender = null;
        message.content = content;
        message.type = MessageType.SYSTEM;
        message.sentAt = LocalDateTime.now();
        message.deleted = false;
        return message;
    }
}
