package com.netmarble.chat.domain.model;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 첨부파일 도메인 모델 (순수 POJO - 인프라 의존 없음)
 */
@Getter
@NoArgsConstructor
public class Attachment {

    private Long id;
    private Long messageId;
    private String fileUrl;
    private String fileType;
    private String fileName;
    private LocalDateTime createdAt;

    public Attachment(Long messageId, String fileUrl, String fileType, String fileName) {
        this.messageId = messageId;
        this.fileUrl = fileUrl;
        this.fileType = fileType;
        this.fileName = fileName;
        this.createdAt = LocalDateTime.now();
    }

    public Attachment(Long id, Long messageId, String fileUrl, String fileType,
                      String fileName, LocalDateTime createdAt) {
        this.id = id;
        this.messageId = messageId;
        this.fileUrl = fileUrl;
        this.fileType = fileType;
        this.fileName = fileName;
        this.createdAt = createdAt;
    }
}
