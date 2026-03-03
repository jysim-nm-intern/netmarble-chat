package com.netmarble.chat.infrastructure.mongo.repository;

import com.netmarble.chat.infrastructure.mongo.document.MessageDocument;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * MongoDB 메시지 레포지토리
 *
 * Cursor-based 페이징 핵심 쿼리:
 *   { roomId, _id: { $lt: cursor } }.sort({ _id: -1 }).limit(n)
 */
@Repository
public interface MessageMongoRepository extends MongoRepository<MessageDocument, String> {

    /**
     * Cursor 이전 메시지 조회 (BEFORE 방향 — 무한 스크롤)
     * idx_room_id 인덱스 사용: { roomId: 1, _id: -1 }
     */
    @Query("{ 'roomId': ?0, '_id': { '$lt': ?1 } }")
    List<MessageDocument> findByRoomIdAndIdLessThan(String roomId, ObjectId cursorId,
        org.springframework.data.domain.Pageable pageable);

    /**
     * Cursor 이후 메시지 조회 (AFTER 방향 — 실시간 보완)
     */
    @Query("{ 'roomId': ?0, '_id': { '$gt': ?1 } }")
    List<MessageDocument> findByRoomIdAndIdGreaterThan(String roomId, ObjectId cursorId,
        org.springframework.data.domain.Pageable pageable);

    /**
     * cursor 없이 최신 메시지 N건 조회 (초기 로드)
     */
    List<MessageDocument> findByRoomIdOrderByIdDesc(String roomId,
        org.springframework.data.domain.Pageable pageable);

    /**
     * 특정 메시지 바로 다음 메시지 존재 여부 확인 (hasMore 계산용)
     */
    Optional<MessageDocument> findFirstByRoomIdAndIdLessThan(String roomId, ObjectId cursorId);

    /**
     * 발신자 ID로 메시지 조회
     */
    List<MessageDocument> findBySenderIdOrderByCreatedAtDesc(String senderId,
        org.springframework.data.domain.Pageable pageable);

    /**
     * readCount 업데이트를 위한 단건 조회
     */
    Optional<MessageDocument> findById(String id);
}
