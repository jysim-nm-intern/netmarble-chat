package com.netmarble.chat.infrastructure.mongo.document;

import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * MongoDB 메시지 문서 (비정규화 모델)
 *
 * 인덱스:
 *   - { roomId: 1, _id: -1 }  → Cursor-based 페이징 핵심
 *   - { senderId: 1, createdAt: -1 } → 발신자별 메시지 이력
 */
@Getter
@NoArgsConstructor
@Document(collection = "messages")
@CompoundIndexes({
    @CompoundIndex(name = "idx_room_id", def = "{'roomId': 1, '_id': -1}"),
    @CompoundIndex(name = "idx_sender_created", def = "{'senderId': 1, 'createdAt': -1}")
})
public class MessageDocument {

    @Id
    private String id;

    private String roomId;
    private String senderId;

    // 비정규화: User JOIN 제거를 위해 발신 시점 닉네임 저장
    private String senderNickname;

    private String content;
    private String type;

    // 첨부파일 정보 (IMAGE / STICKER 메시지에 존재)
    private String attachmentUrl;
    private String attachmentType;

    // 읽음 카운트 (Redis와 주기적 동기화)
    private int readCount = 0;

    @CreatedDate
    private LocalDateTime createdAt;

    @Builder
    public MessageDocument(String roomId, String senderId, String senderNickname,
                           String content, String type,
                           String attachmentUrl, String attachmentType,
                           LocalDateTime createdAt) {
        this.roomId = roomId;
        this.senderId = senderId;
        this.senderNickname = senderNickname;
        this.content = content;
        this.type = type;
        this.attachmentUrl = attachmentUrl;
        this.attachmentType = attachmentType;
        this.createdAt = createdAt != null ? createdAt : LocalDateTime.now();
    }

    public void incrementReadCount() {
        this.readCount++;
    }

    public void syncReadCount(int count) {
        this.readCount = count;
    }
}
