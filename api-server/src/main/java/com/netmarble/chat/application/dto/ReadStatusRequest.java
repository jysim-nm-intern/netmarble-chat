package com.netmarble.chat.application.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * STOMP /app/chat.read 수신 페이로드 (SPEC-READ-001)
 */
@Getter
@NoArgsConstructor
public class ReadStatusRequest {

    /** 읽음 처리할 채팅방 ID */
    private Long roomId;

    /** 읽음 처리 요청 유저 ID */
    private Long userId;

    /** 마지막으로 읽은 메시지 ID */
    private Long lastReadMessageId;
}
