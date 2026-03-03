package com.netmarble.chat.infrastructure.persistence;

import com.netmarble.chat.domain.model.ChatRoomMember;
import com.netmarble.chat.domain.repository.ChatRoomMemberRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.Set;

/**
 * JPA를 사용한 ChatRoomMemberRepository 구현체
 */
@Repository
public interface JpaChatRoomMemberRepository extends JpaRepository<ChatRoomMember, Long>,
        ChatRoomMemberRepository {

    @Override
    @Query("SELECT m FROM ChatRoomMember m LEFT JOIN FETCH m.lastReadMessage " +
           "WHERE m.chatRoom.id = :chatRoomId AND m.user.id = :userId AND m.active = true")
    Optional<ChatRoomMember> findActiveByChatRoomIdAndUserId(
            @Param("chatRoomId") Long chatRoomId,
            @Param("userId") Long userId);

    @Override
    @Query("SELECT m.chatRoom.id FROM ChatRoomMember m WHERE m.user.id = :userId AND m.active = true")
    Set<Long> findActiveChatRoomIdsByUserId(@Param("userId") Long userId);
}
