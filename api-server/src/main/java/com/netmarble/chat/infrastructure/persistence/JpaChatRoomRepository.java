package com.netmarble.chat.infrastructure.persistence;

import com.netmarble.chat.domain.model.ChatRoom;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * JPA ChatRoomRepository 구현체
 *
 * N+1 방지 전략:
 *   - 목록 조회: JOIN FETCH members + user 한 번에 로딩
 *   - 단건 상세: @EntityGraph(attributePaths) 활용
 */
@Repository
public interface JpaChatRoomRepository extends JpaRepository<ChatRoom, Long>,
        com.netmarble.chat.domain.repository.ChatRoomRepository {

    /**
     * 활성 채팅방 목록 + 멤버 + 유저 정보를 단일 쿼리로 조회 (N+1 방지)
     * JOIN FETCH로 members → user 연쇄 로딩을 한 번에 처리
     */
    @Override
    @Query("SELECT DISTINCT c FROM ChatRoom c " +
           "LEFT JOIN FETCH c.members m " +
           "LEFT JOIN FETCH m.user " +
           "WHERE c.active = true " +
           "ORDER BY c.id DESC")
    List<ChatRoom> findAllActive();

    /**
     * 채팅방 상세 + 멤버 + 마지막 읽은 메시지를 단일 쿼리로 조회
     */
    @Override
    @Query("SELECT c FROM ChatRoom c " +
           "LEFT JOIN FETCH c.members m " +
           "LEFT JOIN FETCH m.user " +
           "LEFT JOIN FETCH m.lastReadMessage " +
           "WHERE c.id = :id")
    Optional<ChatRoom> findById(@Param("id") Long id);

    /**
     * 생성자 ID로 채팅방 목록 조회
     */
    @Override
    @Query("SELECT c FROM ChatRoom c WHERE c.creator.id = :creatorId")
    List<ChatRoom> findByCreatorId(@Param("creatorId") Long creatorId);
}
