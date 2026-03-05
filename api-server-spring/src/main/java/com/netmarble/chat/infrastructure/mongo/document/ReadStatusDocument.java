package com.netmarble.chat.infrastructure.mongo.document;

import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * 읽음 상태 문서 — 대규모 방(500명 초과) 전용
 *
 * 500명 이하 방은 Redis에서 카운트만 관리.
 * 500명 초과 방은 이 컬렉션에 상세 기록 저장.
 *
 * 인덱스: { messageId: 1, userId: 1 } UNIQUE → 중복 읽음 방지
 */
@Getter
@NoArgsConstructor
@Document(collection = "read_status")
@CompoundIndexes({
    @CompoundIndex(name = "idx_message_user_unique",
        def = "{'messageId': 1, 'userId': 1}",
        unique = true)
})
public class ReadStatusDocument {

    @Id
    private String id;

    private String messageId;
    private String userId;
    private LocalDateTime readAt;

    @Builder
    public ReadStatusDocument(String messageId, String userId, LocalDateTime readAt) {
        this.messageId = messageId;
        this.userId = userId;
        this.readAt = readAt != null ? readAt : LocalDateTime.now();
    }
}
