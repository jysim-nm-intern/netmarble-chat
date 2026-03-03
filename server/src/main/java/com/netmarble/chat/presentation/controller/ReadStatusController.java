package com.netmarble.chat.presentation.controller;

import com.netmarble.chat.application.dto.UnreadCountResponse;
import com.netmarble.chat.application.service.ReadStatusApplicationService;
import com.netmarble.chat.presentation.exception.UnauthorizedException;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 읽음 상태 관리 REST API Controller
 */
@Slf4j
@RestController
@RequestMapping("/api/read-status")
@RequiredArgsConstructor
public class ReadStatusController {

    private final ReadStatusApplicationService readStatusApplicationService;

    private Long requireUserId(HttpSession session) {
        return Optional.ofNullable(session.getAttribute("userId"))
                .map(o -> (Long) o)
                .orElseThrow(() -> new UnauthorizedException("로그인이 필요합니다."));
    }

    /**
     * 채팅방의 메시지를 읽음 처리
     * POST /api/read-status/mark-read
     */
    @PostMapping("/mark-read")
    public ResponseEntity<Void> markAsRead(
            @RequestParam Long chatRoomId,
            HttpSession session) {
        Long userId = requireUserId(session);
        log.info("POST /api/read-status/mark-read - userId={}, chatRoomId={}", userId, chatRoomId);
        readStatusApplicationService.markAsRead(userId, chatRoomId);
        return ResponseEntity.noContent().build();
    }

    /**
     * 특정 채팅방의 읽지 않은 메시지 개수 조회
     * GET /api/read-status/unread-count?chatRoomId=
     */
    @GetMapping("/unread-count")
    public ResponseEntity<Long> getUnreadCount(
            @RequestParam Long chatRoomId,
            HttpSession session) {
        Long userId = requireUserId(session);
        log.info("GET /api/read-status/unread-count - userId={}, chatRoomId={}", userId, chatRoomId);
        long unreadCount = readStatusApplicationService.getUnreadCount(userId, chatRoomId);
        return ResponseEntity.ok(unreadCount);
    }

    /**
     * 사용자의 모든 채팅방별 읽지 않은 메시지 개수 조회
     * GET /api/read-status/unread-counts
     */
    @GetMapping("/unread-counts")
    public ResponseEntity<Map<Long, Long>> getAllUnreadCounts(HttpSession session) {
        Long userId = requireUserId(session);
        log.info("GET /api/read-status/unread-counts - userId={}", userId);
        Map<Long, Long> unreadCounts = readStatusApplicationService.getAllUnreadCounts(userId);
        return ResponseEntity.ok(unreadCounts);
    }

    /**
     * 활성 채팅방의 읽지 않은 메시지 개수 목록
     * GET /api/read-status/unread-counts-list
     */
    @GetMapping("/unread-counts-list")
    public ResponseEntity<List<UnreadCountResponse>> getUnreadCountsList(HttpSession session) {
        Long userId = requireUserId(session);
        log.info("GET /api/read-status/unread-counts-list - userId={}", userId);
        List<UnreadCountResponse> unreadCounts =
            readStatusApplicationService.getUnreadCountsForActiveChatRooms(userId);
        return ResponseEntity.ok(unreadCounts);
    }
}
