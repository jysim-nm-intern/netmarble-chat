package com.netmarble.chat.application.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 채팅방 입장 요청 DTO
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class JoinChatRoomRequest {

    @NotNull(message = "채팅방 ID는 필수입니다.")
    private Long chatRoomId;

    @NotNull(message = "사용자 ID는 필수입니다.")
    private Long userId;
}
