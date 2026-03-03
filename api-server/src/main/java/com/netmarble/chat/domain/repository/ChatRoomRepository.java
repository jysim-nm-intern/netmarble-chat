package com.netmarble.chat.domain.repository;

import com.netmarble.chat.domain.model.ChatRoom;

import java.util.List;
import java.util.Optional;

/**
 * ChatRoom 도메인 리포지토리 인터페이스
 */
public interface ChatRoomRepository {
    
    ChatRoom save(ChatRoom chatRoom);
    
    Optional<ChatRoom> findById(Long id);
    
    List<ChatRoom> findAllActive();
    
    List<ChatRoom> findByCreatorId(Long creatorId);
    
    void delete(ChatRoom chatRoom);
}
