package com.netmarble.chat.application.dto;

import com.netmarble.chat.domain.model.Attachment;
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
    private String messageType;  // 클라이언트 호환성을 위해 type 값 복사
    private LocalDateTime sentAt;
    private boolean deleted;
    private Integer unreadCount; // 본인 제외 안읽은 사람 수

    // 첨부파일 정보 (IMAGE / STICKER 메시지에 존재)
    private String attachmentUrl;  // 파일 URL (이미지: URL 또는 Base64, 스티커: 스티커 ID)
    private String attachmentType; // IMAGE / STICKER

    /**
     * Domain Entity로부터 DTO 생성 (첨부파일 포함)
     */
    public static MessageResponse from(Message message) {
        Attachment attachment = message.getAttachment();
        String messageType = message.getType().name();
        return MessageResponse.builder()
            .id(message.getId())
            .chatRoomId(message.getChatRoom().getId())
            .senderId(message.getSender() != null ? message.getSender().getId() : null)
            .senderNickname(message.getSender() != null ? message.getSender().getNickname() : "System")
            .content(message.getContent())
            .type(messageType)
            .messageType(messageType)
            .sentAt(message.getSentAt())
            .deleted(message.isDeleted())
            .attachmentUrl(attachment != null ? attachment.getFileUrl() : null)
            .attachmentType(attachment != null ? attachment.getFileType() : null)
            .build();
    }
}
