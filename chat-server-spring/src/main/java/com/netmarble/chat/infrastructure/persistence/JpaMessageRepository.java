package com.netmarble.chat.infrastructure.persistence;

import com.netmarble.chat.domain.model.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * JPA를 사용한 MessageRepository 구현체
 */
@Repository
public interface JpaMessageRepository extends JpaRepository<Message, Long>, 
        com.netmarble.chat.domain.repository.MessageRepository {
    
    @Override
    @Query("SELECT m FROM Message m WHERE m.chatRoom.id = :chatRoomId AND m.deleted = false")
    List<Message> findByChatRoomId(Long chatRoomId);
    
    @Override
    @Query("SELECT m FROM Message m WHERE m.chatRoom.id = :chatRoomId AND m.deleted = false ORDER BY m.sentAt ASC")
    List<Message> findByChatRoomIdOrderBySentAtAsc(Long chatRoomId);
    
    @Override
    @Query("SELECT m FROM Message m WHERE m.chatRoom.id = :chatRoomId AND m.deleted = false AND LOWER(m.content) LIKE LOWER(CONCAT('%', :keyword, '%')) ORDER BY m.sentAt DESC")
    List<Message> searchByChatRoomIdAndKeyword(@Param("chatRoomId") Long chatRoomId, @Param("keyword") String keyword);

    @Override
    @Query("SELECT m FROM Message m WHERE m.chatRoom.id = :chatRoomId AND m.deleted = false AND m.sentAt >= :since ORDER BY m.sentAt ASC")
    List<Message> findByChatRoomIdAndSentAtAfterOrderBySentAtAsc(@Param("chatRoomId") Long chatRoomId, @Param("since") LocalDateTime since);

    @Override
    @Query("SELECT m FROM Message m WHERE m.chatRoom.id = :chatRoomId AND m.deleted = false ORDER BY m.sentAt DESC LIMIT 1")
    Optional<Message> findLastByChatRoomId(@Param("chatRoomId") Long chatRoomId);
}
