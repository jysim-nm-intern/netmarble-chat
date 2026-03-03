package com.netmarble.chat.infrastructure.persistence;

import com.netmarble.chat.domain.model.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * JPA를 사용한 ChatRoomRepository 구현체
 */
@Repository
public interface JpaChatRoomRepository extends JpaRepository<ChatRoom, Long>, 
        com.netmarble.chat.domain.repository.ChatRoomRepository {
    
    @Override
    @Query("SELECT c FROM ChatRoom c WHERE c.active = true ORDER BY c.id DESC")
    List<ChatRoom> findAllActive();
    
    @Override
    @Query("SELECT c FROM ChatRoom c WHERE c.creator.id = :creatorId")
    List<ChatRoom> findByCreatorId(Long creatorId);
}
