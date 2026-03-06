package com.netmarble.chat.infrastructure.mongo.repository;

import com.netmarble.chat.infrastructure.mongo.document.ReadStatusDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 읽음 상태 MongoDB 레포지토리 (대규모 방 전용)
 */
@Repository
public interface ReadStatusMongoRepository extends MongoRepository<ReadStatusDocument, String> {

    boolean existsByMessageIdAndUserId(String messageId, String userId);

    long countByMessageId(String messageId);

    Optional<ReadStatusDocument> findByMessageIdAndUserId(String messageId, String userId);
}
