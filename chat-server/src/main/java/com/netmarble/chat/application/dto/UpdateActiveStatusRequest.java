package com.netmarble.chat.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 활성 상태 업데이트 요청 DTO
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateActiveStatusRequest {
    private Long userId;
    private Long chatRoomId;
    private boolean online;
}
