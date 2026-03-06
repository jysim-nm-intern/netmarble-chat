package com.netmarble.chat.application.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 채팅방 생성 요청 DTO (multipart/form-data 파라미터에서 조립)
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class CreateChatRoomRequest {

    private String name;

    private Long creatorId;

    /** Base64 인코딩된 이미지 Data URL (선택). 예: "data:image/png;base64,..." */
    private String imageUrl;
}
