package com.netmarble.chat.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

/**
 * 읽지 않은 메시지 개수 응답 DTO
 */
@Getter
@Builder
@AllArgsConstructor
public class UnreadCountResponse {
    
    private Long chatRoomId;
    private Long unreadCount;
}
