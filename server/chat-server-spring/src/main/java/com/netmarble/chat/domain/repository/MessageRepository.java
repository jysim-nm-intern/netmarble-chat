package com.netmarble.chat.domain.repository;

import com.netmarble.chat.domain.model.Message;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;


/**
 * Message 도메인 리포지토리 인터페이스
 */
public interface MessageRepository {
    
    Message save(Message message);
    
    Optional<Message> findById(Long id);
    
    List<Message> findByChatRoomId(Long chatRoomId);
    
    List<Message> findByChatRoomIdOrderBySentAtAsc(Long chatRoomId);
    
    /**
     * 채팅방의 메시지 중 검색어를 포함하는 메시지 목록 조회 (최신순)
     * @param chatRoomId 채팅방 ID
     * @param keyword 검색어
     * @return 검색어를 포함하는 메시지 리스트 (전송 시간 역순)
     */
    List<Message> searchByChatRoomIdAndKeyword(Long chatRoomId, String keyword);
    
    /**
     * 채팅방에서 특정 시점 이후의 메시지 목록 조회 (전송 시간 오름차순)
     * 입장 시점(joinedAt) 이후 메시지만 조회할 때 사용
     * @param chatRoomId 채팅방 ID
     * @param since 이 시점 이후(포함)의 메시지만 반환
     */
    List<Message> findByChatRoomIdAndSentAtAfterOrderBySentAtAsc(Long chatRoomId, LocalDateTime since);

    /**
     * 채팅방의 가장 최근 메시지 1건 조회
     */
    Optional<Message> findLastByChatRoomId(Long chatRoomId);

    void delete(Message message);
}
