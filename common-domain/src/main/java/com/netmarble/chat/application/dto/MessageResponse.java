package com.netmarble.chat.application.dto;

import com.netmarble.chat.domain.model.Message;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * 메시지 응답 DTO
 */
@Getter
@Builder
@AllArgsConstructor
public class MessageResponse {

    private Long id;
    private Long chatRoomId;
    private Long senderId;
    private String senderNickname;
    private String content;
    private String type;
    private String messageType;
    private LocalDateTime sentAt;
    private boolean deleted;
    private Integer unreadCount;

    private String attachmentUrl;
    private String attachmentType;

    public static MessageResponse from(Message message) {
        String messageType = message.getType().name();
        return MessageResponse.builder()
            .id(message.getId())
            .chatRoomId(message.getChatRoomId())
            .senderId(message.getSenderId())
            .senderNickname(message.getSenderNickname() != null ? message.getSenderNickname() : "System")
            .content(message.getContent())
            .type(messageType)
            .messageType(messageType)
            .sentAt(message.getSentAt())
            .deleted(message.isDeleted())
            .build();
    }
}
