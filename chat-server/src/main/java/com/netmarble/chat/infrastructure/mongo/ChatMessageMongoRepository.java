package com.netmarble.chat.infrastructure.mongo;

import org.springframework.data.mongodb.repository.MongoRepository;

/**
 * chat-server MongoDB 메시지 쓰기 전용 Repository.
 * STOMP 메시지 수신 시 비정규화 문서를 저장한다.
 */
public interface ChatMessageMongoRepository extends MongoRepository<ChatMessageDocument, String> {
}
