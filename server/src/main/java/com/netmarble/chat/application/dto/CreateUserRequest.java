package com.netmarble.chat.application.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 사용자 생성 요청 DTO (multipart/form-data 파라미터에서 조립)
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class CreateUserRequest {

    private String nickname;

    /** 프로필 아바타 색상 (hex 코드, 선택) */
    private String profileColor;

    /** Base64 인코딩된 프로필 이미지 Data URL (선택). 예: "data:image/png;base64,..." */
    private String profileImage;
}
