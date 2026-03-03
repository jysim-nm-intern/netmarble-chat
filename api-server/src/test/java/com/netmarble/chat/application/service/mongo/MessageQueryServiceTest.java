package com.netmarble.chat.application.service.mongo;

import com.netmarble.chat.application.dto.cursor.CursorPageResponse;
import com.netmarble.chat.infrastructure.mongo.document.MessageDocument;
import com.netmarble.chat.infrastructure.mongo.repository.MessageMongoRepository;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;

/**
 * Cursor-based 메시지 페이징 단위 테스트
 */
@ExtendWith(MockitoExtension.class)
class MessageQueryServiceTest {

    @Mock
    private MessageMongoRepository messageMongoRepository;

    @InjectMocks
    private MessageQueryService messageQueryService;

    private MessageDocument makeDoc(String roomId, String senderId) {
        MessageDocument doc = MessageDocument.builder()
            .roomId(roomId)
            .senderId(senderId)
            .senderNickname("testUser")
            .content("테스트 메시지")
            .type("TEXT")
            .createdAt(LocalDateTime.now())
            .build();
        ReflectionTestUtils.setField(doc, "id", new ObjectId().toHexString());
        return doc;
    }

    @Test
    @DisplayName("cursor 없이 최신 메시지 50건 반환")
    void findByCursor_noCursor_returnsLatest() {
        String roomId = "room-1";
        List<MessageDocument> docs = List.of(makeDoc(roomId, "1"), makeDoc(roomId, "2"));
        given(messageMongoRepository.findByRoomIdOrderByIdDesc(eq(roomId), any(Pageable.class)))
            .willReturn(docs);
        given(messageMongoRepository.findFirstByRoomIdAndIdLessThan(any(), any()))
            .willReturn(Optional.empty());

        CursorPageResponse<?> response = messageQueryService.findByCursor(
            roomId, null, 50, MessageQueryService.Direction.BEFORE);

        assertThat(response.getMessages()).hasSize(2);
        assertThat(response.isHasMore()).isFalse();
        assertThat(response.getNextCursor()).isNotNull();
    }

    @Test
    @DisplayName("cursor 있을 때 BEFORE 방향 이전 메시지 조회")
    void findByCursor_withCursor_before_returnsOlderMessages() {
        String roomId = "room-1";
        ObjectId cursor = new ObjectId();
        List<MessageDocument> docs = List.of(makeDoc(roomId, "1"));
        given(messageMongoRepository.findByRoomIdAndIdLessThan(eq(roomId), eq(cursor), any(Pageable.class)))
            .willReturn(docs);
        given(messageMongoRepository.findFirstByRoomIdAndIdLessThan(any(), any()))
            .willReturn(Optional.empty());

        CursorPageResponse<?> response = messageQueryService.findByCursor(
            roomId, cursor.toHexString(), 50, MessageQueryService.Direction.BEFORE);

        assertThat(response.getMessages()).hasSize(1);
    }

    @Test
    @DisplayName("결과가 없으면 빈 응답 반환")
    void findByCursor_empty_returnsEmptyResponse() {
        String roomId = "room-empty";
        given(messageMongoRepository.findByRoomIdOrderByIdDesc(eq(roomId), any(Pageable.class)))
            .willReturn(List.of());

        CursorPageResponse<?> response = messageQueryService.findByCursor(
            roomId, null, 50, MessageQueryService.Direction.BEFORE);

        assertThat(response.getMessages()).isEmpty();
        assertThat(response.isHasMore()).isFalse();
        assertThat(response.getNextCursor()).isNull();
    }

    @Test
    @DisplayName("limit 100 초과 시 100으로 제한")
    void findByCursor_limitExceedsMax_cappedAt100() {
        String roomId = "room-1";
        given(messageMongoRepository.findByRoomIdOrderByIdDesc(eq(roomId), any(Pageable.class)))
            .willAnswer(invocation -> {
                Pageable pageable = invocation.getArgument(1);
                assertThat(pageable.getPageSize()).isLessThanOrEqualTo(100);
                return List.of();
            });

        messageQueryService.findByCursor(roomId, null, 999, MessageQueryService.Direction.BEFORE);
    }

    @Test
    @DisplayName("다음 페이지 존재 시 hasMore=true 반환")
    void findByCursor_hasNextPage_hasMoreTrue() {
        String roomId = "room-1";
        List<MessageDocument> docs = List.of(makeDoc(roomId, "1"), makeDoc(roomId, "2"));
        given(messageMongoRepository.findByRoomIdOrderByIdDesc(eq(roomId), any(Pageable.class)))
            .willReturn(docs);
        given(messageMongoRepository.findFirstByRoomIdAndIdLessThan(any(), any()))
            .willReturn(Optional.of(makeDoc(roomId, "0")));

        CursorPageResponse<?> response = messageQueryService.findByCursor(
            roomId, null, 50, MessageQueryService.Direction.BEFORE);

        assertThat(response.isHasMore()).isTrue();
    }
}
