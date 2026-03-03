package com.netmarble.chat.application.dto.cursor;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * MongoDB 메시지 응답 DTO
 *
 * {@link com.netmarble.chat.application.dto.MessageResponse}는 id를 Long으로 관리하나,
 * MongoDB 메시지는 ObjectId(hex string)를 id로 사용하므로 별도 DTO를 사용합니다.
 */
@Getter
@Builder
@AllArgsConstructor
public class MongoMessageResponse {

    /** MongoDB ObjectId hex string (커서 페이징 식별자) */
    private String id;

    private Long chatRoomId;
    private Long senderId;
    private String senderNickname;
    private String content;
    private String type;
    private String messageType;
    private java.time.LocalDateTime sentAt;
    private boolean deleted;

    /** 읽음 카운트 (Redis와 주기적 동기화) */
    private Integer readCount;

    private String attachmentUrl;
    private String attachmentType;
}
