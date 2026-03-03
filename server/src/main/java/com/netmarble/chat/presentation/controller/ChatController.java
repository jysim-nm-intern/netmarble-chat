package com.netmarble.chat.presentation.controller;

import com.netmarble.chat.application.service.MessageApplicationService;
import com.netmarble.chat.application.service.ReadStatusApplicationService;
import com.netmarble.chat.application.service.ChatRoomApplicationService;
import com.netmarble.chat.presentation.exception.UnauthorizedException;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 채팅 관련 추가 REST API Controller
 * 클라이언트 호환성을 위한 엔드포인트
 */
@Slf4j
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final MessageApplicationService messageApplicationService;
    private final ReadStatusApplicationService readStatusApplicationService;
    private final ChatRoomApplicationService chatRoomApplicationService;

    private Long requireUserId(HttpSession session) {
        return Optional.ofNullable(session.getAttribute("userId"))
                .map(o -> (Long) o)
                .orElseThrow(() -> new UnauthorizedException("로그인이 필요합니다."));
    }

    /**
     * 채팅방의 메시지별 안읽은 사용자 수 매핑 조회
     * GET /api/chat/unread-count/{chatRoomId}
     */
    @GetMapping("/unread-count/{chatRoomId}")
    public ResponseEntity<Map<String, Long>> getUnreadCountMapping(@PathVariable Long chatRoomId) {
        log.info("GET /api/chat/unread-count/{} - Fetching unread count mapping", chatRoomId);

        try {
            var messages = messageApplicationService.getChatRoomMessages(chatRoomId, null);
            Map<String, Long> unreadMapping = new HashMap<>();

            for (var message : messages) {
                if (message.getUnreadCount() != null && message.getUnreadCount() > 0) {
                    String key = String.valueOf(message.getUnreadCount());
                    unreadMapping.put(key, message.getId());
                }
            }

            log.info("Unread count mapping for chatRoomId {}: {}", chatRoomId, unreadMapping);
            return ResponseEntity.ok(unreadMapping);
        } catch (Exception e) {
            log.error("Error fetching unread count mapping for chatRoomId {}", chatRoomId, e);
            return ResponseEntity.ok(new HashMap<>());
        }
    }

    /**
     * 사용자 활성 상태 및 마지막 읽은 메시지 ID 업데이트
     * POST /api/chat/update-status-and-logid
     *
     * Request Body:
     * {
     *   "chatRoomId": 1,
     *   "isOnline": true,
     *   "logId": 123 (선택적)
     * }
     * 세션에서 userId를 추출하므로 Body의 nickname/userId는 무시된다.
     */
    @PostMapping("/update-status-and-logid")
    public ResponseEntity<Void> updateStatusAndLogId(
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        Long userId = requireUserId(session);
        Long chatRoomId = Long.valueOf(request.get("chatRoomId").toString());
        Boolean isOnline = (Boolean) request.get("isOnline");

        log.info("POST /api/chat/update-status-and-logid - chatRoomId={}, userId={}, isOnline={}",
                 chatRoomId, userId, isOnline);

        try {
            chatRoomApplicationService.updateMemberActiveStatus(chatRoomId, userId, isOnline);

            if (!isOnline && request.containsKey("logId") && request.get("logId") != null) {
                readStatusApplicationService.markAsRead(userId, chatRoomId);
            }

            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Error updating status and logId", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 사용자의 마지막 읽음 시간 업데이트
     * POST /api/chat/update-read-status
     *
     * Request Body:
     * {
     *   "chatRoomId": 1
     * }
     * 세션에서 userId를 추출하므로 Body의 nickname은 무시된다.
     */
    @PostMapping("/update-read-status")
    public ResponseEntity<Void> updateReadStatus(
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        Long userId = requireUserId(session);
        Long chatRoomId = Long.valueOf(request.get("chatRoomId").toString());

        log.info("POST /api/chat/update-read-status - chatRoomId={}, userId={}", chatRoomId, userId);

        try {
            readStatusApplicationService.markAsRead(userId, chatRoomId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Error updating read status", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 메시지 검색
     * GET /api/chat-rooms/{chatRoomId}/messages/search?keyword=검색어
     */
    @GetMapping("/chat-rooms/{chatRoomId}/messages/search")
    public ResponseEntity<?> searchMessages(@PathVariable Long chatRoomId,
                                           @RequestParam String keyword) {
        log.info("GET /api/chat-rooms/{}/messages/search?keyword={}", chatRoomId, keyword);

        try {
            var searchResults = messageApplicationService.searchMessages(chatRoomId, keyword);
            return ResponseEntity.ok(searchResults);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid search request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Error searching messages", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "메시지 검색 중 오류가 발생했습니다."));
        }
    }
}
