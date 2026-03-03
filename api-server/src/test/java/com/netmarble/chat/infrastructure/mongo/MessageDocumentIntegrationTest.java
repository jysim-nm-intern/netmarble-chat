package com.netmarble.chat.infrastructure.mongo;

import com.netmarble.chat.infrastructure.mongo.document.MessageDocument;
import com.netmarble.chat.infrastructure.mongo.repository.MessageMongoRepository;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * MongoDB 메시지 저장/조회 통합 테스트
 *
 * @DataMongoTest: 내장 MongoDB (Flapdoodle) 사용
 * @Tag("integration"): 일반 test 태스크 제외, integrationTest 태스크에서 실행
 */
@DataMongoTest
@Tag("integration")
class MessageDocumentIntegrationTest {

    @Autowired
    private MessageMongoRepository messageMongoRepository;

    @AfterEach
    void cleanup() {
        messageMongoRepository.deleteAll();
    }

    @Test
    @DisplayName("메시지 저장 후 roomId로 조회")
    void saveAndFindByRoomId() {
        MessageDocument doc = MessageDocument.builder()
            .roomId("room-1")
            .senderId("user-1")
            .senderNickname("테스터")
            .content("안녕하세요")
            .type("TEXT")
            .createdAt(LocalDateTime.now())
            .build();

        messageMongoRepository.save(doc);

        List<MessageDocument> results = messageMongoRepository
            .findByRoomIdOrderByIdDesc("room-1", PageRequest.of(0, 10));

        assertThat(results).hasSize(1);
        assertThat(results.get(0).getContent()).isEqualTo("안녕하세요");
        assertThat(results.get(0).getSenderNickname()).isEqualTo("테스터");
    }

    @Test
    @DisplayName("Cursor-based 페이징 - cursor 이전 메시지만 반환")
    void findBeforeCursor() {
        String roomId = "room-cursor";
        List<MessageDocument> saved = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            MessageDocument doc = MessageDocument.builder()
                .roomId(roomId)
                .senderId("user-" + i)
                .senderNickname("유저" + i)
                .content("메시지 " + i)
                .type("TEXT")
                .createdAt(LocalDateTime.now())
                .build();
            saved.add(messageMongoRepository.save(doc));
        }

        // 3번째 문서의 ID를 cursor로 사용 → 그 이전(더 오래된) 메시지만 반환
        String cursorId = saved.get(2).getId();
        PageRequest pageable = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "_id"));

        List<MessageDocument> results = messageMongoRepository
            .findByRoomIdAndIdLessThan(roomId, new ObjectId(cursorId), pageable);

        assertThat(results).hasSize(2);
        // 결과는 cursor보다 이전(ID 작은) 메시지들이어야 함
        results.forEach(doc ->
            assertThat(new ObjectId(doc.getId()))
                .isLessThan(new ObjectId(cursorId)));
    }

    @Test
    @DisplayName("비정규화 필드 - senderNickname이 올바르게 저장됨")
    void denormalizedSenderNickname() {
        MessageDocument doc = MessageDocument.builder()
            .roomId("room-2")
            .senderId("user-42")
            .senderNickname("닉네임테스터")
            .content("비정규화 테스트")
            .type("TEXT")
            .createdAt(LocalDateTime.now())
            .build();

        MessageDocument saved = messageMongoRepository.save(doc);

        assertThat(saved.getSenderNickname()).isEqualTo("닉네임테스터");
        // User 조인 없이 바로 조회 가능한지 확인
        MessageDocument found = messageMongoRepository.findById(saved.getId()).orElseThrow();
        assertThat(found.getSenderNickname()).isEqualTo("닉네임테스터");
    }
}
