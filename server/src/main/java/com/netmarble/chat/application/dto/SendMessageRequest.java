package com.netmarble.chat.application.dto;

import com.netmarble.chat.domain.model.Message;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 메시지 전송 요청 DTO
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SendMessageRequest {

    @NotNull(message = "채팅방 ID는 필수입니다.")
    private Long chatRoomId;

    @NotNull(message = "발신자 ID는 필수입니다.")
    private Long senderId;

    @NotBlank(message = "메시지 내용은 필수입니다.")
    // 이미지는 Base64로 인코딩되어 크기가 커지므로 TEXT는 5000자, IMAGE/STICKER는 10MB까지 허용
    @Size(max = 10485760, message = "메시지는 10MB를 초과할 수 없습니다.")
    private String content;

    // messageType을 받기 위한 별도 필드 (클라이언트가 보낸 타입)
    private String messageType;

    private Message.MessageType type = Message.MessageType.TEXT;

    private String fileName;

    /**
     * 클라이언트에서 보낸 messageType 문자열을 Message.MessageType enum으로 변환
     */
    public void convertMessageType() {
        if (messageType != null && !messageType.isEmpty()) {
            try {
                this.type = Message.MessageType.valueOf(messageType.toUpperCase());
            } catch (IllegalArgumentException e) {
                this.type = Message.MessageType.TEXT;
            }
        }
    }

    /**
     * 메시지 타입별 유효성 검증
     */
    public void validateByMessageType() {
        convertMessageType();
        
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("메시지 내용은 비어있을 수 없습니다.");
        }
        
        // TEXT 메시지: 5000자 제한
        if (type == Message.MessageType.TEXT) {
            if (content.length() > 5000) {
                throw new IllegalArgumentException("텍스트 메시지는 5000자를 초과할 수 없습니다.");
            }
        }
        // STICKER: 크기 제한 없음 (이모지만 포함)
        else if (type == Message.MessageType.STICKER) {
            // 스티커는 검증 불필요
        }
        // IMAGE: 10MB(Base64) 제한 (원본 약 7.5MB)
        else if (type == Message.MessageType.IMAGE) {
            if (content.length() > 10485760) {  // 약 10MB in Base64
                throw new IllegalArgumentException("이미지는 약 7.5MB를 초과할 수 없습니다.");
            }
            if (fileName == null || fileName.trim().isEmpty()) {
                throw new IllegalArgumentException("이미지 파일명은 필수입니다.");
            }
        }
    }
}
