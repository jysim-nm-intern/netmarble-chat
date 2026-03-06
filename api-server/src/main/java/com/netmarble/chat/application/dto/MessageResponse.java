package com.netmarble.chat.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * api-server 전용 메시지 응답 DTO.
 * MongoDB MessageDocument에서 직접 변환하며, domain Entity 의존성 없음.
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
}
