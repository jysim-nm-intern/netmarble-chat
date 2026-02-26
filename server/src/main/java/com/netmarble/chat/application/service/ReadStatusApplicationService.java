package com.netmarble.chat.application.service;

import com.netmarble.chat.application.dto.ReadStatusUpdateEvent;
import com.netmarble.chat.application.dto.UnreadCountResponse;
import com.netmarble.chat.domain.model.ChatRoom;
import com.netmarble.chat.domain.model.ChatRoomMember;
import com.netmarble.chat.domain.model.Message;
import com.netmarble.chat.domain.model.User;
import com.netmarble.chat.domain.repository.ChatRoomMemberRepository;
import com.netmarble.chat.domain.repository.ChatRoomRepository;
import com.netmarble.chat.domain.repository.MessageRepository;
import com.netmarble.chat.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 읽음 상태 관리 서비스 (ChatRoomMember 기반)
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReadStatusApplicationService {

    private final MessageRepository messageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomMemberRepository chatRoomMemberRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 채팅방의 마지막 메시지까지 읽음 처리 (ChatRoomMember의 lastReadMessage 업데이트)
     */
    @Transactional
    public void markAsRead(Long userId, Long chatRoomId) {
        log.info("[READ STATUS] Marking messages as read: userId={}, chatRoomId={}", userId, chatRoomId);
        
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + userId));

        // 채팅방의 마지막 메시지 단건 조회
        Message lastMessage = messageRepository.findLastByChatRoomId(chatRoomId).orElse(null);
        if (lastMessage == null) {
            log.info("[READ STATUS] No messages to mark as read");
            return;
        }

        // ChatRoomMember 직접 조회 (ChatRoom 전체 로드 없이 해당 멤버만 조회)
        ChatRoomMember member = chatRoomMemberRepository
            .findActiveByChatRoomIdAndUserId(chatRoomId, userId)
            .orElseThrow(() -> new IllegalArgumentException("채팅방 멤버를 찾을 수 없습니다"));

        Long previousMessageId = member.getLastReadMessage() != null ?
            member.getLastReadMessage().getId() : null;

        // 마지막 읽은 메시지 업데이트 후 해당 멤버만 저장
        member.updateLastReadMessage(lastMessage);
        chatRoomMemberRepository.save(member);
        
        log.info("[READ STATUS] 읽음 처리 완료 - userId={}, chatRoomId={}, previousMessageId={}, newMessageId={}", 
                 userId, chatRoomId, previousMessageId, lastMessage.getId());
        
        // WebSocket을 통해 채팅방의 모든 사용자에게 읽음 상태 업데이트 알림
        ReadStatusUpdateEvent event = ReadStatusUpdateEvent.builder()
            .chatRoomId(chatRoomId)
            .userId(userId)
            .userNickname(user.getNickname())
            .lastReadMessageId(lastMessage.getId())
            .updatedAt(LocalDateTime.now())
            .type("READ_STATUS_UPDATE")
            .build();
        
        messagingTemplate.convertAndSend("/topic/chatroom/" + chatRoomId + "/read-status", event);
        log.info("[READ STATUS] 읽음 상태 업데이트 전송 - chatRoomId={}, userId={}, lastReadMessageId={}", 
                 chatRoomId, userId, lastMessage.getId());
    }

    /**
     * 특정 채팅방의 읽지 않은 메시지 개수 조회 (ChatRoomMember 기반)
     */
    public long getUnreadCount(Long userId, Long chatRoomId) {
        ChatRoom chatRoom = chatRoomRepository.findById(chatRoomId)
            .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다: " + chatRoomId));
        
        var member = chatRoom.getMembers().stream()
            .filter(m -> m.getUser().getId().equals(userId) && m.isActive())
            .findFirst()
            .orElse(null);
        
        if (member == null) {
            return 0;
        }
        
        List<Message> allMessages = messageRepository.findByChatRoomIdOrderBySentAtAsc(chatRoomId);
        
        if (member.getLastReadMessage() == null) {
            // 한 번도 읽지 않았으면 모든 메시지가 읽지 않은 메시지
            // 단, 시스템 메시지와 본인이 보낸 메시지는 제외
            return allMessages.stream()
                .filter(m -> m.getSender() != null && !m.getSender().getId().equals(userId))
                .count();
        }
        
        // 마지막으로 읽은 메시지 이후의 메시지만 카운트
        Long lastReadMessageId = member.getLastReadMessage().getId();
        boolean foundLastRead = false;
        long unreadCount = 0;
        
        for (Message message : allMessages) {
            if (message.getId().equals(lastReadMessageId)) {
                foundLastRead = true;
                continue;
            }
            
            if (foundLastRead && message.getSender() != null && 
                !message.getSender().getId().equals(userId)) {
                unreadCount++;
            }
        }
        
        return unreadCount;
    }

    /**
     * 사용자의 모든 채팅방별 읽지 않은 메시지 개수 조회
     */
    public Map<Long, Long> getAllUnreadCounts(Long userId) {
        log.info("Getting all unread counts for user: {}", userId);
        
        List<ChatRoom> activeChatRooms = chatRoomRepository.findAllActive();
        Map<Long, Long> unreadCounts = new HashMap<>();
        
        for (ChatRoom chatRoom : activeChatRooms) {
            // 사용자가 해당 채팅방의 멤버인지 확인
            boolean isMember = chatRoom.getMembers().stream()
                .anyMatch(m -> m.getUser().getId().equals(userId) && m.isActive());
            
            if (isMember) {
                long unreadCount = getUnreadCount(userId, chatRoom.getId());
                unreadCounts.put(chatRoom.getId(), unreadCount);
            }
        }
        
        return unreadCounts;
    }

    /**
     * 채팅방별 읽지 않은 메시지 개수 목록 (활성 채팅방 전체)
     */
    public List<UnreadCountResponse> getUnreadCountsForActiveChatRooms(Long userId) {
        List<ChatRoom> activeChatRooms = chatRoomRepository.findAllActive();
        
        return activeChatRooms.stream()
            .filter(chatRoom -> chatRoom.getMembers().stream()
                .anyMatch(m -> m.getUser().getId().equals(userId) && m.isActive()))
            .map(chatRoom -> {
                long unreadCount = getUnreadCount(userId, chatRoom.getId());
                return UnreadCountResponse.builder()
                    .chatRoomId(chatRoom.getId())
                    .unreadCount(unreadCount)
                    .build();
            })
            .collect(Collectors.toList());
    }
}
