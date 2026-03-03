package com.netmarble.chat.application.service.mongo;

import com.netmarble.chat.application.dto.cursor.CursorPageResponse;
import com.netmarble.chat.application.dto.cursor.MongoMessageResponse;
import com.netmarble.chat.infrastructure.mongo.document.MessageDocument;
import com.netmarble.chat.infrastructure.mongo.repository.MessageMongoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Cursor-based 메시지 이력 조회 서비스
 *
 * GET /api/chat-rooms/{roomId}/messages?cursor={id}&limit=50&direction=BEFORE
 *
 * MongoDB 쿼리: { roomId, _id: { $lt: cursor } }.sort({ _id: -1 }).limit(n)
 * ObjectId 자체가 시간 순서를 포함하므로 별도 createdAt 정렬 인덱스 불필요.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MessageQueryService {

    private static final int MAX_LIMIT = 100;
    private static final int DEFAULT_LIMIT = 50;

    private final MessageMongoRepository messageMongoRepository;

    public enum Direction {
        BEFORE, AFTER
    }

    /**
     * Cursor-based 메시지 페이징 조회
     *
     * @param roomId    채팅방 ID
     * @param cursor    마지막으로 본 메시지 ObjectId (null이면 최신부터)
     * @param limit     요청 건수 (최대 100, 0 이하이면 DEFAULT_LIMIT 적용)
     * @param direction BEFORE(이전) or AFTER(이후)
     */
    public CursorPageResponse<MongoMessageResponse> findByCursor(
            String roomId, String cursor, int limit, Direction direction) {

        int safeLimit = (limit <= 0) ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
        log.debug("[MessageQuery] roomId={}, cursor={}, limit={}, direction={}", roomId, cursor, safeLimit, direction);

        List<MessageDocument> docs;

        if (cursor == null || cursor.isBlank() || !ObjectId.isValid(cursor)) {
            // cursor 없음 또는 유효하지 않은 cursor → 최신 메시지로 fallback
            if (cursor != null && !cursor.isBlank() && !ObjectId.isValid(cursor)) {
                log.warn("[MessageQuery] 유효하지 않은 cursor 값, 최신 메시지로 fallback: cursor={}", cursor);
            }
            PageRequest page = PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "_id"));
            docs = messageMongoRepository.findByRoomIdOrderByIdDesc(roomId, page);
        } else {
            ObjectId cursorId = new ObjectId(cursor);
            PageRequest page = PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "_id"));

            if (direction == Direction.BEFORE) {
                docs = messageMongoRepository.findByRoomIdAndIdLessThan(roomId, cursorId, page);
            } else {
                PageRequest ascPage = PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.ASC, "_id"));
                docs = messageMongoRepository.findByRoomIdAndIdGreaterThan(roomId, cursorId, ascPage);
            }
        }

        if (docs.isEmpty()) {
            return CursorPageResponse.empty();
        }

        List<MongoMessageResponse> responses = docs.stream()
            .map(MessageQueryService::toResponse)
            .collect(Collectors.toList());

        // 마지막 문서의 ID가 nextCursor
        String nextCursor = docs.get(docs.size() - 1).getId();

        // 다음 페이지 존재 여부 확인
        boolean hasMore = direction != Direction.AFTER &&
            messageMongoRepository.findFirstByRoomIdAndIdLessThan(
                roomId, new ObjectId(nextCursor)).isPresent();

        return CursorPageResponse.of(responses, nextCursor, hasMore);
    }

    private static MongoMessageResponse toResponse(MessageDocument doc) {
        String senderNickname = doc.getSenderNickname() != null ? doc.getSenderNickname() : "System";
        return MongoMessageResponse.builder()
            .id(doc.getId())
            .chatRoomId(parseIdSafely(doc.getRoomId()))
            .senderId(parseIdSafely(doc.getSenderId()))
            .senderNickname(senderNickname)
            .content(doc.getContent())
            .type(doc.getType())
            .messageType(doc.getType())  // 클라이언트 호환성을 위해 type 값 복사
            .attachmentUrl(doc.getAttachmentUrl())
            .attachmentType(doc.getAttachmentType())
            .readCount(doc.getReadCount())
            .sentAt(doc.getCreatedAt())
            .deleted(false)
            .build();
    }

    private static Long parseIdSafely(String id) {
        if (id == null || id.isBlank()) return null;
        try { return Long.parseLong(id); } catch (NumberFormatException ignored) { return null; }
    }
}
