package com.netmarble.chat.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 읽음 상태 업데이트 이벤트 DTO
 * 누군가 메시지를 읽었을 때 채팅방의 다른 사용자들에게 알림
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReadStatusUpdateEvent {
    
    /**
     * 채팅방 ID
     */
    private Long chatRoomId;
    
    /**
     * 메시지를 읽은 사용자 ID
     */
    private Long userId;
    
    /**
     * 읽은 사용자 닉네임
     */
    private String userNickname;
    
    /**
     * 마지막으로 읽은 메시지 ID
     */
    private Long lastReadMessageId;
    
    /**
     * 읽음 처리로 영향받는 메시지 ID 목록
     * (이전에 읽지 않았던 메시지들 중 이번에 읽음 처리된 메시지들)
     */
    private List<Long> affectedMessageIds;
    
    /**
     * 업데이트 시간
     */
    private LocalDateTime updatedAt;
    
    /**
     * 이벤트 타입 (항상 "READ_STATUS_UPDATE")
     */
    @Builder.Default
    private String type = "READ_STATUS_UPDATE";
}
