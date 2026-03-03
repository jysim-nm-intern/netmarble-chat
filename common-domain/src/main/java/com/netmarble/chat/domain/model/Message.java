package com.netmarble.chat.domain.model;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 메시지 도메인 모델 (순수 POJO - 인프라 의존 없음)
 */
@Getter
@NoArgsConstructor
public class Message {

    private Long id;
    private Long chatRoomId;
    private Long senderId;
    private String senderNickname;
    private String content;
    private MessageType type;
    private LocalDateTime sentAt;
    private boolean deleted;

    public enum MessageType {
        TEXT,
        IMAGE,
        STICKER,
        SYSTEM
    }

    public Message(Long chatRoomId, Long senderId, String senderNickname, String content, MessageType type) {
        validateContent(content, type);
        this.chatRoomId = chatRoomId;
        this.senderId = senderId;
        this.senderNickname = senderNickname;
        this.content = content;
        this.type = type;
        this.sentAt = LocalDateTime.now();
        this.deleted = false;
    }

    public Message(Long chatRoomId, Long senderId, String senderNickname, String content) {
        this(chatRoomId, senderId, senderNickname, content, MessageType.TEXT);
    }

    public Message(Long id, Long chatRoomId, Long senderId, String senderNickname,
                   String content, MessageType type, LocalDateTime sentAt, boolean deleted) {
        this.id = id;
        this.chatRoomId = chatRoomId;
        this.senderId = senderId;
        this.senderNickname = senderNickname;
        this.content = content;
        this.type = type;
        this.sentAt = sentAt;
        this.deleted = deleted;
    }

    private void validateContent(String content, MessageType type) {
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("메시지 내용은 비어있을 수 없습니다.");
        }
        if (type == MessageType.TEXT && content.length() > 5000) {
            throw new IllegalArgumentException("메시지는 5000자를 초과할 수 없습니다.");
        }
    }

    public void delete() {
        this.deleted = true;
    }

    public static Message createSystemMessage(Long chatRoomId, String content) {
        Message message = new Message();
        message.chatRoomId = chatRoomId;
        message.senderId = null;
        message.senderNickname = null;
        message.content = content;
        message.type = MessageType.SYSTEM;
        message.sentAt = LocalDateTime.now();
        message.deleted = false;
        return message;
    }
}
