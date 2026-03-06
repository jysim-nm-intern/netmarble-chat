package com.netmarble.chat.infrastructure.persistence;

import com.netmarble.chat.domain.model.Attachment;
import com.netmarble.chat.domain.repository.AttachmentRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * JPA를 사용한 AttachmentRepository 구현체
 */
@Repository
public interface JpaAttachmentRepository extends JpaRepository<Attachment, Long>,
        AttachmentRepository {

    @Override
    Optional<Attachment> findByMessageId(Long messageId);
}
