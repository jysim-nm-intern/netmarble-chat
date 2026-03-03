package com.netmarble.chat.domain.repository;

import com.netmarble.chat.domain.model.ChatRoomMember;

import java.util.Optional;
import java.util.Set;

/**
 * ChatRoomMember 도메인 리포지토리 인터페이스
 */
public interface ChatRoomMemberRepository {

    ChatRoomMember save(ChatRoomMember member);

    /**
     * 특정 채팅방의 활성 멤버 단건 조회 (lastReadMessage JOIN FETCH 포함)
     */
    Optional<ChatRoomMember> findActiveByChatRoomIdAndUserId(Long chatRoomId, Long userId);

    /**
     * 유저가 활성 멤버로 참가 중인 채팅방 ID 목록 조회 (단일 쿼리)
     */
    Set<Long> findActiveChatRoomIdsByUserId(Long userId);
}
