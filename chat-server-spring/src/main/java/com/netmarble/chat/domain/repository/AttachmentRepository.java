package com.netmarble.chat.domain.repository;

import com.netmarble.chat.domain.model.Attachment;

import java.util.Optional;

/**
 * Attachment 저장소 인터페이스 (DDD - 인프라 독립)
 */
public interface AttachmentRepository {

    Attachment save(Attachment attachment);

    Optional<Attachment> findByMessageId(Long messageId);

    void delete(Attachment attachment);
}
