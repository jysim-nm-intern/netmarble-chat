package com.netmarble.chat.infrastructure.mongo;

import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * chat-server의 MongoDB 메시지 쓰기 전용 Document.
 *
 * STOMP 핸들러가 메시지 수신 시 비정규화 형태로 저장한다.
 * api-server의 MessageDocument와 동일한 "messages" 컬렉션을 공유한다.
 *
 * 인덱스:
 *   { roomId: 1, _id: -1 } → api-server cursor-based 페이징과 호환
 */
@Getter
@NoArgsConstructor
@Document(collection = "messages")
@CompoundIndexes({
    @CompoundIndex(name = "idx_room_id", def = "{'roomId': 1, '_id': -1}"),
    @CompoundIndex(name = "idx_sender_created", def = "{'senderId': 1, 'createdAt': -1}")
})
public class ChatMessageDocument {

    @Id
    private String id;

    private String roomId;
    private String senderId;
    private String senderNickname;
    private String content;
    private String type;
    private int readCount = 0;
    private LocalDateTime createdAt;

    @Builder
    public ChatMessageDocument(String roomId, String senderId, String senderNickname,
                               String content, String type) {
        this.roomId = roomId;
        this.senderId = senderId;
        this.senderNickname = senderNickname;
        this.content = content;
        this.type = type;
        this.createdAt = LocalDateTime.now();
    }
}
