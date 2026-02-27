package com.netmarble.chat.presentation.controller;

import com.netmarble.chat.application.dto.MessageResponse;
import com.netmarble.chat.application.dto.SendMessageRequest;
import com.netmarble.chat.application.service.MessageApplicationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * WebSocket 메시지 컨트롤러 (STOMP)
 * 실시간 메시지 송수신 처리
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class WebSocketMessageController {

    private final MessageApplicationService messageApplicationService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 메시지 전송 (WebSocket)
     * 클라이언트에서 /app/chat.sendMessage로 메시지를 보내면
     * 처리 후 /topic/chatroom/{chatRoomId}로 브로드캐스트
     */
    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload @Valid SendMessageRequest request) {
        log.info("WebSocket message received: chatRoomId={}, senderId={}", 
                 request.getChatRoomId(), request.getSenderId());
        
        try {
            // 메시지 저장 (unreadCount 포함)
            MessageResponse response = messageApplicationService.sendMessage(request);

            // 채팅방 구독자들에게 브로드캐스트
            messagingTemplate.convertAndSend(
                "/topic/chatroom/" + request.getChatRoomId(),
                response
            );
            
            log.info("Message broadcasted to /topic/chatroom/{}", request.getChatRoomId());
        } catch (Exception e) {
            log.error("Error sending message", e);
            // 에러를 발신자에게만 전송
            messagingTemplate.convertAndSendToUser(
                request.getSenderId().toString(),
                "/queue/errors",
                e.getMessage()
            );
        }
    }

    /**
     * 사용자 입장 알림
     */
    @MessageMapping("/chat.addUser")
    public void addUser(@Payload SendMessageRequest request) {
        log.info("User joining chat room: chatRoomId={}, userId={}", 
                 request.getChatRoomId(), request.getSenderId());
        
        try {
            MessageResponse response = messageApplicationService.sendMessage(request);
            
            messagingTemplate.convertAndSend(
                "/topic/chatroom/" + request.getChatRoomId(), 
                response
            );
        } catch (Exception e) {
            log.error("Error adding user", e);
        }
    }
}

/**
 * REST API Controller (메시지 조회용)
 */
@Slf4j
@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
class MessageController {

    private final MessageApplicationService messageApplicationService;

    /**
     * 채팅방의 메시지 목록 조회
     * GET /api/messages/chatroom/{chatRoomId}?userId={userId}
     * userId가 있으면 해당 사용자의 입장 시점 이후 메시지만 반환한다.
     */
    @GetMapping("/chatroom/{chatRoomId}")
    public List<MessageResponse> getChatRoomMessages(
            @PathVariable Long chatRoomId,
            @RequestParam(required = false) Long userId) {
        log.info("GET /api/messages/chatroom/{} - Fetching messages (userId={})", chatRoomId, userId);
        return messageApplicationService.getChatRoomMessages(chatRoomId, userId);
    }

    /**
     * 메시지 ID로 조회
     * GET /api/messages/{id}
     */
    @GetMapping("/{id}")
    public MessageResponse getMessageById(@PathVariable Long id) {
        log.info("GET /api/messages/{} - Fetching message", id);
        return messageApplicationService.getMessageById(id);
    }

    /**
     * 메시지 삭제
     * DELETE /api/messages/{id}
     */
    @DeleteMapping("/{id}")
    public void deleteMessage(@PathVariable Long id, @RequestParam Long userId) {
        log.info("DELETE /api/messages/{} - User {} deleting message", id, userId);
        messageApplicationService.deleteMessage(id, userId);
    }
}
