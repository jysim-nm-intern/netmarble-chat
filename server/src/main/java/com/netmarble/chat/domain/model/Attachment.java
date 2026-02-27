package com.netmarble.chat.domain.model;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "attachments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id", nullable = false, unique = true)
    private Message message;

    // 파일 URL (이미지: 서버 경로 URL, 스티커: 스티커 ID ex. STK_01)
    // 개발 단계에서는 Base64 데이터 임시 저장 가능
    @Column(name = "file_url", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String fileUrl;

    // 파일 종류: IMAGE / STICKER
    @Column(name = "file_type", nullable = false, length = 50)
    private String fileType;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public Attachment(Message message, String fileUrl, String fileType) {
        if (fileUrl == null || fileUrl.isBlank()) {
            throw new IllegalArgumentException("첨부파일 URL은 비어있을 수 없습니다.");
        }
        if (fileType == null || fileType.isBlank()) {
            throw new IllegalArgumentException("첨부파일 타입은 비어있을 수 없습니다.");
        }
        this.message = message;
        this.fileUrl = fileUrl;
        this.fileType = fileType;
        this.createdAt = LocalDateTime.now();
    }
}
