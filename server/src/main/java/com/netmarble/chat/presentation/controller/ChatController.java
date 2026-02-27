package com.netmarble.chat.presentation.controller;

import com.netmarble.chat.application.service.MessageApplicationService;
import com.netmarble.chat.application.service.ReadStatusApplicationService;
import com.netmarble.chat.application.service.ChatRoomApplicationService;
import com.netmarble.chat.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

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
    private final UserRepository userRepository;

    /**
     * 채팅방의 메시지별 안읽은 사용자 수 매핑 조회
     * GET /api/chat/unread-count/{chatRoomId}
     * 
     * 응답 형식: { "1": lastMessageIdWith1UnreadUser, "2": lastMessageIdWith2UnreadUsers, ... }
     * 클라이언트에서 메시지 ID로 안읽은 사용자 수를 빠르게 계산하기 위한 매핑
     */
    @GetMapping("/unread-count/{chatRoomId}")
    public ResponseEntity<Map<String, Long>> getUnreadCountMapping(@PathVariable Long chatRoomId) {
        log.info("GET /api/chat/unread-count/{} - Fetching unread count mapping", chatRoomId);
        
        try {
            var messages = messageApplicationService.getChatRoomMessages(chatRoomId, null);
            Map<String, Long> unreadMapping = new HashMap<>();
            
            // 메시지를 순회하면서 안읽은 사용자 수별로 마지막 메시지 ID를 기록
            // 예: unreadCount가 1인 마지막 메시지 ID, 2인 마지막 메시지 ID, ...
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
     *   "nickname": "사용자닉네임",
     *   "isOnline": true,
     *   "logId": 123 (선택적)
     * }
     */
    @PostMapping("/update-status-and-logid")
    public ResponseEntity<Void> updateStatusAndLogId(@RequestBody Map<String, Object> request) {
        Long chatRoomId = Long.valueOf(request.get("chatRoomId").toString());
        String nickname = request.get("nickname").toString();
        Boolean isOnline = (Boolean) request.get("isOnline");
        
        log.info("POST /api/chat/update-status-and-logid - chatRoomId={}, nickname={}, isOnline={}", 
                 chatRoomId, nickname, isOnline);
        
        try {
            // 닉네임으로 사용자 조회
            var user = userRepository.findByNickname(nickname)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + nickname));
            
            // 활성 상태 업데이트
            chatRoomApplicationService.updateMemberActiveStatus(chatRoomId, user.getId(), isOnline);
            
            // 온라인이 아닐 때 logId가 제공된 경우, 해당 메시지까지 읽음 처리
            // (온라인일 때는 자동으로 읽음 처리되므로 별도 처리 불필요)
            if (!isOnline && request.containsKey("logId") && request.get("logId") != null) {
                // 오프라인으로 전환 시점의 마지막 메시지까지 읽음 처리
                readStatusApplicationService.markAsRead(user.getId(), chatRoomId);
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
     *   "chatRoomId": 1,
     *   "nickname": "사용자닉네임"
     * }
     */
    @PostMapping("/update-read-status")
    public ResponseEntity<Void> updateReadStatus(@RequestBody Map<String, Object> request) {
        Long chatRoomId = Long.valueOf(request.get("chatRoomId").toString());
        String nickname = request.get("nickname").toString();
        
        log.info("POST /api/chat/update-read-status - chatRoomId={}, nickname={}", chatRoomId, nickname);
        
        try {
            // 닉네임으로 사용자 조회
            var user = userRepository.findByNickname(nickname)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + nickname));
            
            // 마지막 메시지까지 읽음 처리
            readStatusApplicationService.markAsRead(user.getId(), chatRoomId);
            
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Error updating read status", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 메시지 검색
     * GET /api/chat-rooms/{chatRoomId}/messages/search?keyword=검색어
     * 
     * @param chatRoomId 채팅방 ID
     * @param keyword 검색 키워드
     * @return 검색된 메시지 목록
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

