package com.netmarble.chat.application.service;

import com.netmarble.chat.application.dto.MessageResponse;
import com.netmarble.chat.application.dto.SendMessageRequest;
import com.netmarble.chat.domain.model.Attachment;
import com.netmarble.chat.domain.model.ChatRoom;
import com.netmarble.chat.domain.model.Message;
import com.netmarble.chat.domain.model.User;
import com.netmarble.chat.domain.repository.AttachmentRepository;
import com.netmarble.chat.domain.repository.ChatRoomMemberRepository;
import com.netmarble.chat.domain.repository.ChatRoomRepository;
import com.netmarble.chat.domain.repository.MessageRepository;
import com.netmarble.chat.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Message 애플리케이션 서비스
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MessageApplicationService {

    private final MessageRepository messageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final UserRepository userRepository;
    private final AttachmentRepository attachmentRepository;
    private final ChatRoomMemberRepository chatRoomMemberRepository;

    /**
     * 메시지 전송
     */
    @Transactional
    public MessageResponse sendMessage(SendMessageRequest request) {
        log.info("Sending message to chat room {}", request.getChatRoomId());
        
        // 메시지 타입별 유효성 검증
        request.validateByMessageType();
        
        ChatRoom chatRoom = chatRoomRepository.findById(request.getChatRoomId())
            .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다: " + request.getChatRoomId()));
        
        User sender = userRepository.findById(request.getSenderId())
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + request.getSenderId()));
        
        // 사용자가 채팅방 멤버인지 확인
        if (!chatRoom.isActiveMember(sender)) {
            throw new IllegalArgumentException("채팅방에 참여하지 않은 사용자입니다.");
        }
        
        // 클라이언트가 보낸 messageType 문자열을 enum으로 변환
        request.convertMessageType();

        // 메시지 생성 및 저장
        Message savedMessage;
        if (request.getType() == Message.MessageType.IMAGE) {
            // IMAGE: content(Base64) → Attachment.fileUrl, fileName → Message.content(alt text)
            savedMessage = messageRepository.save(
                new Message(chatRoom, sender, request.getFileName(), Message.MessageType.IMAGE));
            Attachment imageAttachment = attachmentRepository.save(
                new Attachment(savedMessage, request.getContent(), "IMAGE"));

            log.info("Message sent: id={}, chatRoomId={}, sender={}, type={}",
                     savedMessage.getId(), chatRoom.getId(), sender.getNickname(), request.getType());

            // @OneToOne(fetch=LAZY) 이슈 우회: attachment를 직접 포함하여 응답 빌드
            return buildResponseWithAttachment(savedMessage, imageAttachment, calculateUnreadCount(chatRoom, savedMessage));
        } else if (request.getType() == Message.MessageType.STICKER) {
            // STICKER: content(스티커 이모지) → Attachment.fileUrl, Message.content는 플레이스홀더
            savedMessage = messageRepository.save(
                new Message(chatRoom, sender, "[스티커]", Message.MessageType.STICKER));
            Attachment stickerAttachment = attachmentRepository.save(
                new Attachment(savedMessage, request.getContent(), "STICKER"));

            log.info("Message sent: id={}, chatRoomId={}, sender={}, type={}",
                     savedMessage.getId(), chatRoom.getId(), sender.getNickname(), request.getType());

            // @OneToOne(fetch=LAZY) 이슈 우회: attachment를 직접 포함하여 응답 빌드
            return buildResponseWithAttachment(savedMessage, stickerAttachment, calculateUnreadCount(chatRoom, savedMessage));
        } else {
            savedMessage = messageRepository.save(
                new Message(chatRoom, sender, request.getContent(), request.getType()));
        }

        log.info("Message sent: id={}, chatRoomId={}, sender={}, type={}",
                 savedMessage.getId(), chatRoom.getId(), sender.getNickname(), request.getType());

        int unreadCount = calculateUnreadCount(chatRoom, savedMessage);
        String messageType = savedMessage.getType().name();
        return MessageResponse.builder()
            .id(savedMessage.getId())
            .chatRoomId(savedMessage.getChatRoom().getId())
            .senderId(savedMessage.getSender().getId())
            .senderNickname(savedMessage.getSender().getNickname())
            .content(savedMessage.getContent())
            .type(messageType)
            .messageType(messageType)
            .sentAt(savedMessage.getSentAt())
            .deleted(savedMessage.isDeleted())
            .unreadCount(unreadCount)
            .build();
    }

    /**
     * 채팅방의 메시지 목록 조회 (안읽은 사람 수 포함)
     * userId가 제공되면 해당 사용자의 입장 시점(joinedAt) 이후 메시지만 반환한다.
     * userId가 null이면 전체 메시지를 반환한다.
     */
    public List<MessageResponse> getChatRoomMessages(Long chatRoomId, Long userId) {
        log.info("Fetching messages for chat room {} (userId={})", chatRoomId, userId);

        // 채팅방 존재 확인
        ChatRoom chatRoom = chatRoomRepository.findById(chatRoomId)
            .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다: " + chatRoomId));

        List<Message> messages;
        if (userId != null) {
            // 입장 시점 이후 메시지만 조회
            messages = chatRoomMemberRepository.findActiveByChatRoomIdAndUserId(chatRoomId, userId)
                .map(member -> {
                    log.info("User {} joined at {}, fetching messages since then", userId, member.getJoinedAt());
                    return messageRepository.findByChatRoomIdAndSentAtAfterOrderBySentAtAsc(chatRoomId, member.getJoinedAt());
                })
                .orElseGet(() -> {
                    log.info("User {} is not an active member of chat room {}, returning empty list", userId, chatRoomId);
                    return List.of();
                });
        } else {
            messages = messageRepository.findByChatRoomIdOrderBySentAtAsc(chatRoomId);
        }
        
        return messages.stream()
            .map(message -> {
                MessageResponse response = MessageResponse.from(message);
                // 안읽은 사람 수 계산 (시스템 메시지가 아닌 경우만)
                if (message.getSender() != null) {
                    int unreadCount = calculateUnreadCount(chatRoom, message);
                    return MessageResponse.builder()
                        .id(response.getId())
                        .chatRoomId(response.getChatRoomId())
                        .senderId(response.getSenderId())
                        .senderNickname(response.getSenderNickname())
                        .content(response.getContent())
                        .type(response.getType())
                        .messageType(response.getMessageType())
                        .attachmentUrl(response.getAttachmentUrl())
                        .attachmentType(response.getAttachmentType())
                        .sentAt(response.getSentAt())
                        .deleted(response.isDeleted())
                        .unreadCount(unreadCount)
                        .build();
                }
                return response;
            })
            .collect(Collectors.toList());
    }
    
    /**
     * IMAGE/STICKER 메시지 응답 빌드 (JPA @OneToOne LAZY 이슈 우회)
     * savedMessage.getAttachment()가 null을 반환하므로 attachment를 직접 전달받아 빌드
     */
    private MessageResponse buildResponseWithAttachment(Message message, Attachment attachment, int unreadCount) {
        String messageType = message.getType().name();
        return MessageResponse.builder()
            .id(message.getId())
            .chatRoomId(message.getChatRoom().getId())
            .senderId(message.getSender() != null ? message.getSender().getId() : null)
            .senderNickname(message.getSender() != null ? message.getSender().getNickname() : "System")
            .content(message.getContent())
            .type(messageType)
            .messageType(messageType)
            .sentAt(message.getSentAt())
            .deleted(message.isDeleted())
            .attachmentUrl(attachment.getFileUrl())
            .attachmentType(attachment.getFileType())
            .unreadCount(unreadCount)
            .build();
    }

    /**
     * 메시지별 안읽은 사람 수 계산
     * ChatRoomMember의 lastReadMessage를 기준으로 계산
     */
    private int calculateUnreadCount(ChatRoom chatRoom, Message message) {
        // 이 메시지를 읽지 않은 멤버 수 계산 (본인 제외, 활성 멤버만)
        long unreadCount = chatRoom.getMembers().stream()
            .filter(member -> member.isActive())
            .filter(member -> !member.getUser().getId().equals(message.getSender().getId()))
            .filter(member -> !member.hasReadMessage(message))
            .count();
        
        return (int) unreadCount;
    }

    /**
     * 메시지 ID로 조회
     */
    public MessageResponse getMessageById(Long id) {
        Message message = messageRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("메시지를 찾을 수 없습니다: " + id));
        return MessageResponse.from(message);
    }

    /**
     * 메시지 삭제 (소프트 삭제)
     */
    @Transactional
    public void deleteMessage(Long messageId, Long userId) {
        log.info("Deleting message {} by user {}", messageId, userId);
        
        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new IllegalArgumentException("메시지를 찾을 수 없습니다: " + messageId));
        
        // 메시지 작성자만 삭제 가능
        if (message.getSender() == null || !message.getSender().getId().equals(userId)) {
            throw new IllegalArgumentException("메시지를 삭제할 권한이 없습니다.");
        }
        
        message.delete();
        messageRepository.save(message);
        
        log.info("Message deleted: id={}", messageId);
    }

    /**
     * 메시지 검색 (채팅방 내에서 키워드로 검색)
     * @param chatRoomId 채팅방 ID
     * @param keyword 검색 키워드
     * @return 검색된 메시지 리스트 (전송 시간 역순)
     */
    public List<MessageResponse> searchMessages(Long chatRoomId, String keyword) {
        log.info("Searching messages in chat room {} with keyword: {}", chatRoomId, keyword);
        
        // 검색어 유효성 검증 (trim 후 빈값 체크)
        if (keyword == null || keyword.trim().isEmpty()) {
            throw new IllegalArgumentException("검색어는 비어있을 수 없습니다.");
        }

        String trimmedKeyword = keyword.trim();

        if (trimmedKeyword.length() > 255) {
            throw new IllegalArgumentException("검색어는 255자를 초과할 수 없습니다.");
        }

        // 채팅방 존재 확인
        ChatRoom chatRoom = chatRoomRepository.findById(chatRoomId)
            .orElseThrow(() -> new IllegalArgumentException("채팅방을 찾을 수 없습니다: " + chatRoomId));

        // 리포지토리에서 검색 수행 (trim된 키워드 사용)
        List<Message> messages = messageRepository.searchByChatRoomIdAndKeyword(chatRoomId, trimmedKeyword);
        
        log.info("Found {} messages matching keyword: {}", messages.size(), keyword);
        
        return messages.stream()
            .map(message -> {
                MessageResponse response = MessageResponse.from(message);
                // 안읽은 사람 수 계산 (시스템 메시지가 아닌 경우만)
                if (message.getSender() != null) {
                    int unreadCount = calculateUnreadCount(chatRoom, message);
                    return MessageResponse.builder()
                        .id(response.getId())
                        .chatRoomId(response.getChatRoomId())
                        .senderId(response.getSenderId())
                        .senderNickname(response.getSenderNickname())
                        .content(response.getContent())
                        .type(response.getType())
                        .messageType(response.getMessageType())
                        .attachmentUrl(response.getAttachmentUrl())
                        .attachmentType(response.getAttachmentType())
                        .sentAt(response.getSentAt())
                        .deleted(response.isDeleted())
                        .unreadCount(unreadCount)
                        .build();
                }
                return response;
            })
            .collect(Collectors.toList());
    }
}
