package com.netmarble.chat.application.service;

import com.netmarble.chat.application.dto.*;
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
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * ChatRoom 애플리케이션 서비스
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatRoomApplicationService {

    private final ChatRoomRepository chatRoomRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final ChatRoomMemberRepository chatRoomMemberRepository;
    private final ReadStatusApplicationService readStatusApplicationService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 채팅방 생성
     */
    @Transactional
    public ChatRoomResponse createChatRoom(CreateChatRoomRequest request) {
        log.info("Creating chat room: {}", request.getName());
        
        User creator = userRepository.findById(request.getCreatorId())
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + request.getCreatorId()));
        
        ChatRoom chatRoom = new ChatRoom(request.getName(), request.getImageUrl(), creator);
        ChatRoom savedChatRoom = chatRoomRepository.save(chatRoom);
        
        // 시스템 메시지: 채팅방 생성
        Message systemMessage = Message.createSystemMessage(
            savedChatRoom, 
            creator.getNickname() + "님이 채팅방을 생성했습니다."
        );
        messageRepository.save(systemMessage);
        
        log.info("Chat room created: id={}, name={}", savedChatRoom.getId(), savedChatRoom.getName());
        
        return ChatRoomResponse.from(savedChatRoom);
    }

    /**
     * 채팅방 목록 조회 (활성 채팅방, isMember/읽지 않은 수/마지막 메시지/멤버 아바타 포함)
     */
    public List<ChatRoomResponse> getAllActiveChatRooms(Long userId) {
        // 최근 100개 방만 조회 (N+1 쿼리 부하 제한 - 방이 누적될수록 응답 지연 방지)
        List<ChatRoom> chatRooms = chatRoomRepository.findAllActive().stream()
            .limit(100)
            .collect(Collectors.toList());

        // 단일 쿼리로 유저가 참가 중인 채팅방 ID Set 조회 (lazy loading 의존 제거)
        Set<Long> memberRoomIds = (userId != null)
            ? chatRoomMemberRepository.findActiveChatRoomIdsByUserId(userId)
            : Set.of();

        return chatRooms.stream()
            .map(chatRoom -> buildRoomResponse(chatRoom, userId, memberRoomIds))
            .collect(Collectors.toList());
    }

    /**
     * 채팅방 응답 DTO 빌드 (공통 로직)
     */
    private ChatRoomResponse buildRoomResponse(ChatRoom chatRoom, Long userId, Set<Long> memberRoomIds) {
        // 1. 멤버 여부 — DB에서 직접 조회한 Set으로 판단 (lazy loading 불필요)
        boolean isMember = memberRoomIds.contains(chatRoom.getId());

        // 2. 읽지 않은 메시지 수 — 참가 중인 방에만 계산
        long unreadCount = (userId != null && isMember)
            ? readStatusApplicationService.getUnreadCount(userId, chatRoom.getId())
            : 0L;

        // 3. 마지막 메시지 — 참가 중인 방에만 조회 (비멤버는 내용 미공개)
        String lastMessageContent = null;
        LocalDateTime lastMessageAt = null;
        if (isMember) {
            Optional<Message> lastMsgOpt = messageRepository.findLastByChatRoomId(chatRoom.getId());
            lastMessageContent = lastMsgOpt.map(m -> switch (m.getType()) {
                case IMAGE   -> "[사진]";
                case STICKER -> "[스티커]";
                default      -> m.getContent();
            }).orElse(null);
            lastMessageAt = lastMsgOpt.map(Message::getSentAt).orElse(null);
        }

        // 4. 멤버 아바타 (최대 4명 — 현재 참여 중인 멤버만, 본인 항상 제외, 입장 시간순)
        List<ChatRoomResponse.MemberAvatar> memberAvatars = chatRoom.getMembers().stream()
            .filter(ChatRoomMember::isActive)
            .filter(m -> userId == null || !m.getUser().getId().equals(userId))
            .sorted(Comparator.comparing(ChatRoomMember::getJoinedAt))
            .limit(4)
            .map(m -> new ChatRoomResponse.MemberAvatar(
                m.getUser().getProfileColor(),
                m.getUser().getProfileImage(),
                m.getUser().getNickname()
            ))
            .collect(Collectors.toList());

        return ChatRoomResponse.builder()
            .id(chatRoom.getId())
            .name(chatRoom.getName())
            .imageUrl(chatRoom.getImageUrl())
            .creatorId(chatRoom.getCreator().getId())
            .creatorNickname(chatRoom.getCreator().getNickname())
            .createdAt(chatRoom.getCreatedAt())
            .active(chatRoom.isActive())
            .memberCount(chatRoom.getActiveMemberCount())
            .unreadCount(unreadCount)
            .isMember(isMember)
            .lastMessageContent(lastMessageContent)
            .lastMessageAt(lastMessageAt)
            .memberAvatars(memberAvatars)
            .build();
    }

    /**
     * 채팅방 상세 조회
     */
    public ChatRoomResponse getChatRoomById(Long id) {
        ChatRoom chatRoom = chatRoomRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다: " + id));
        return ChatRoomResponse.from(chatRoom);
    }

    /**
     * 채팅방 입장
     */
    @Transactional
    public ChatRoomResponse joinChatRoom(JoinChatRoomRequest request) {
        log.info("User {} joining chat room {}", request.getUserId(), request.getChatRoomId());
        
        ChatRoom chatRoom = chatRoomRepository.findById(request.getChatRoomId())
            .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다: " + request.getChatRoomId()));
        
        User user = userRepository.findById(request.getUserId())
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + request.getUserId()));
        
        // 멤버 추가 (중복 입장 시 false 반환)
        boolean isNewJoin = chatRoom.addMember(user);

        if (isNewJoin) {
            // 새로 입장하거나 재입장한 경우에만 시스템 메시지 생성
            Message systemMessage = Message.createSystemMessage(
                chatRoom,
                user.getNickname() + "님이 입장했습니다."
            );
            Message savedSystemMessage = messageRepository.save(systemMessage);

            // WebSocket을 통해 실시간으로 브로드캐스트
            MessageResponse response = MessageResponse.from(savedSystemMessage);
            messagingTemplate.convertAndSend(
                "/topic/chatroom/" + chatRoom.getId(),
                response
            );

            log.info("User {} joined chat room {} (new join)", user.getNickname(), chatRoom.getName());
        } else {
            // 이미 활성 멤버인 경우 - 읽음 처리만 수행
            log.info("User {} already in chat room {} (marking as read)", user.getNickname(), chatRoom.getName());
        }

        // 입장 시 마지막 메시지까지 읽음 처리 (최신 메시지 1건만 조회)
        messageRepository.findLastByChatRoomId(chatRoom.getId())
            .ifPresent(lastMessage -> {
                chatRoom.getMembers().stream()
                    .filter(member -> member.getUser().getId().equals(user.getId()))
                    .findFirst()
                    .ifPresent(member -> member.updateLastReadMessage(lastMessage));
                log.info("Last read message updated for user {} in chat room {}", user.getNickname(), chatRoom.getName());
            });

        chatRoomRepository.save(chatRoom);
        
        return ChatRoomResponse.from(chatRoom);
    }

    /**
     * 채팅방 퇴장
     */
    @Transactional
    public void leaveChatRoom(Long chatRoomId, Long userId) {
        log.info("User {} leaving chat room {}", userId, chatRoomId);
        
        ChatRoom chatRoom = chatRoomRepository.findById(chatRoomId)
            .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다: " + chatRoomId));
        
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + userId));
        
        chatRoom.removeMember(user);
        chatRoomRepository.save(chatRoom);
        
        // 시스템 메시지: 사용자 퇴장
        Message systemMessage = Message.createSystemMessage(
            chatRoom,
            user.getNickname() + "님이 퇴장했습니다."
        );
        Message savedSystemMessage = messageRepository.save(systemMessage);
        
        // WebSocket을 통해 실시간으로 브로드캐스트
        MessageResponse response = MessageResponse.from(savedSystemMessage);
        messagingTemplate.convertAndSend(
            "/topic/chatroom/" + chatRoom.getId(),
            response
        );
        
        log.info("User {} left chat room {}", user.getNickname(), chatRoom.getName());
    }

    /**
     * 채팅방 멤버 목록 조회 (활성 멤버만)
     */
    public List<ChatRoomMemberResponse> getActiveChatRoomMembers(Long chatRoomId) {
        ChatRoom chatRoom = chatRoomRepository.findById(chatRoomId)
            .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다: " + chatRoomId));
        
        return chatRoom.getMembers().stream()
            .filter(member -> member.isActive())
            .map(ChatRoomMemberResponse::from)
            .collect(Collectors.toList());
    }
    
    /**
     * 채팅방 멤버 활성 상태 업데이트
     * 온라인 상태로 전환 시 자동으로 읽음 처리 수행
     */
    @Transactional
    public void updateMemberActiveStatus(Long chatRoomId, Long userId, boolean online) {
        log.info("Updating member active status: chatRoomId={}, userId={}, online={}", 
                 chatRoomId, userId, online);
        
        ChatRoom chatRoom = chatRoomRepository.findById(chatRoomId)
            .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다: " + chatRoomId));
        
        chatRoom.getMembers().stream()
            .filter(member -> member.getUser().getId().equals(userId))
            .findFirst()
            .ifPresent(member -> {
                member.updateActiveStatus(online);
                
                // 온라인 상태로 전환 시 마지막 메시지까지 읽음 처리 (최신 메시지 1건만 조회)
                if (online) {
                    messageRepository.findLastByChatRoomId(chatRoomId)
                        .ifPresent(lastMessage -> {
                            member.updateLastReadMessage(lastMessage);
                            log.info("Auto-marked as read for user {} when going online in chat room {}", userId, chatRoomId);
                        });
                }
            });
        
        chatRoomRepository.save(chatRoom);
    }
    
    /**
     * 채팅방 멤버 활동 업데이트 (하트비트)
     * 활동 업데이트 시 자동으로 읽음 처리도 수행
     */
    @Transactional
    public void updateMemberActivity(Long chatRoomId, Long userId) {
        ChatRoom chatRoom = chatRoomRepository.findById(chatRoomId)
            .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다: " + chatRoomId));
        
        chatRoom.getMembers().stream()
            .filter(member -> member.getUser().getId().equals(userId))
            .findFirst()
            .ifPresent(member -> {
                member.updateActivity();
                // 활동 중인 사용자는 자동으로 읽음 처리 (최신 메시지 1건만 조회)
                messageRepository.findLastByChatRoomId(chatRoomId)
                    .ifPresent(member::updateLastReadMessage);
            });
        
        chatRoomRepository.save(chatRoom);
    }
}
