package com.netmarble.chat.presentation.controller;

import com.netmarble.chat.application.dto.MessageResponse;
import com.netmarble.chat.application.dto.SendMessageRequest;
import com.netmarble.chat.application.service.MessageApplicationService;
import com.netmarble.chat.infrastructure.interceptor.StompAuthChannelInterceptor;
import com.netmarble.chat.presentation.exception.UnauthorizedException;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

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
     * senderId는 반드시 세션에서 추출하여 클라이언트 payload 값을 무시한다.
     */
    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload SendMessageRequest request,
                            SimpMessageHeaderAccessor headerAccessor) {
        Long sessionUserId = StompAuthChannelInterceptor.getSessionUserId(headerAccessor);
        if (sessionUserId == null) {
            log.warn("STOMP sendMessage 거부: 세션에 userId 없음");
            throw new org.springframework.messaging.MessageDeliveryException("인증이 필요합니다.");
        }

        // 클라이언트가 보낸 senderId를 무시하고 세션 값으로 교체
        request.setSenderId(sessionUserId);

        log.info("WebSocket message received: chatRoomId={}, senderId={}",
                 request.getChatRoomId(), sessionUserId);

        try {
            MessageResponse response = messageApplicationService.sendMessage(request);

            messagingTemplate.convertAndSend(
                "/topic/chatroom/" + request.getChatRoomId(),
                response
            );

            log.info("Message broadcasted to /topic/chatroom/{}", request.getChatRoomId());
        } catch (Exception e) {
            log.error("Error sending message", e);
            messagingTemplate.convertAndSendToUser(
                sessionUserId.toString(),
                "/queue/errors",
                e.getMessage()
            );
        }
    }

    /**
     * 사용자 입장 알림
     * senderId는 세션에서 추출하여 클라이언트 payload 값을 무시한다.
     */
    @MessageMapping("/chat.addUser")
    public void addUser(@Payload SendMessageRequest request,
                        SimpMessageHeaderAccessor headerAccessor) {
        Long sessionUserId = StompAuthChannelInterceptor.getSessionUserId(headerAccessor);
        if (sessionUserId == null) {
            log.warn("STOMP addUser 거부: 세션에 userId 없음");
            return;
        }

        // 클라이언트가 보낸 senderId를 세션 값으로 교체
        request.setSenderId(sessionUserId);

        log.info("User joining chat room: chatRoomId={}, userId={}",
                 request.getChatRoomId(), sessionUserId);

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

    private Long requireUserId(HttpSession session) {
        return Optional.ofNullable(session.getAttribute("userId"))
                .map(o -> (Long) o)
                .orElseThrow(() -> new UnauthorizedException("로그인이 필요합니다."));
    }

    /**
     * 채팅방의 메시지 목록 조회
     * GET /api/messages/chatroom/{chatRoomId}
     * 세션 userId 기준으로 해당 사용자의 입장 시점 이후 메시지만 반환한다.
     * (클라이언트가 userId를 조작해도 서버가 세션 userId를 신뢰하므로 joinedAt 백데이팅 불가)
     */
    @GetMapping("/chatroom/{chatRoomId}")
    public List<MessageResponse> getChatRoomMessages(
            @PathVariable Long chatRoomId,
            HttpSession session) {
        Long userId = requireUserId(session);
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
     * 세션 userId를 사용하여 본인 메시지만 삭제 가능
     */
    @DeleteMapping("/{id}")
    public void deleteMessage(
            @PathVariable Long id,
            HttpSession session) {
        Long userId = requireUserId(session);
        log.info("DELETE /api/messages/{} - User {} deleting message", id, userId);
        messageApplicationService.deleteMessage(id, userId);
    }
}
