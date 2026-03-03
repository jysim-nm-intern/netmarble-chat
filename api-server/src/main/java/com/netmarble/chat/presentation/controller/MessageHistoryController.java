package com.netmarble.chat.presentation.controller;

import com.netmarble.chat.application.dto.MessageResponse;
import com.netmarble.chat.application.dto.cursor.CursorPageResponse;
import com.netmarble.chat.application.service.mongo.MessageQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * 메시지 이력 조회 REST 컨트롤러 (api-server 전담).
 *
 * GET /api/rooms/{roomId}/messages
 *   ?cursor={objectId}  — 마지막으로 본 메시지 ID (없으면 최신부터)
 *   &limit={n}          — 요청 건수 (기본 50, 최대 100)
 *   &direction=BEFORE   — BEFORE(이전 메시지) | AFTER(이후 메시지)
 *
 * MongoDB cursor-based 페이징으로 N+1 없이 O(log n) 조회.
 */
@Slf4j
@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class MessageHistoryController {

    private final MessageQueryService messageQueryService;

    @GetMapping("/{roomId}/messages")
    public CursorPageResponse<MessageResponse> getMessages(
            @PathVariable String roomId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "BEFORE") MessageQueryService.Direction direction) {

        log.info("GET /api/rooms/{}/messages cursor={}, limit={}, dir={}", roomId, cursor, limit, direction);
        return messageQueryService.findByCursor(roomId, cursor, limit, direction);
    }
}
