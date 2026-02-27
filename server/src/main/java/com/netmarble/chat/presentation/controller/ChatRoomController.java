package com.netmarble.chat.presentation.controller;

import com.netmarble.chat.application.dto.*;
import com.netmarble.chat.application.service.ChatRoomApplicationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * ChatRoom REST API Controller
 * SPEC-ROOM-001 ~ 004 (채팅방 목록/생성/입장/퇴장)
 */
@Slf4j
@RestController
@RequestMapping("/api/chat-rooms")
@RequiredArgsConstructor
public class ChatRoomController {

    private final ChatRoomApplicationService chatRoomApplicationService;

    /**
     * 채팅방 생성
     * POST /api/chat-rooms (multipart/form-data)
     */
    @PostMapping(consumes = {MediaType.MULTIPART_FORM_DATA_VALUE, MediaType.APPLICATION_FORM_URLENCODED_VALUE})
    public ResponseEntity<ChatRoomResponse> createChatRoom(
            @RequestParam String name,
            @RequestParam Long creatorId,
            @RequestParam(required = false) MultipartFile image) {
        log.info("POST /api/chat-rooms - name={}", name);

        String imageUrl = null;
        if (image != null && !image.isEmpty()) {
            imageUrl = encodeImageToBase64(image);
        }

        CreateChatRoomRequest request = new CreateChatRoomRequest(name, creatorId, imageUrl);
        ChatRoomResponse response = chatRoomApplicationService.createChatRoom(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * 활성 채팅방 목록 조회
     * GET /api/chat-rooms?userId=
     */
    @GetMapping
    public ResponseEntity<List<ChatRoomResponse>> getAllActiveChatRooms(
            @RequestParam(required = false) Long userId) {
        log.info("GET /api/chat-rooms userId={}", userId);
        return ResponseEntity.ok(chatRoomApplicationService.getAllActiveChatRooms(userId));
    }

    /**
     * 채팅방 상세 조회
     * GET /api/chat-rooms/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ChatRoomResponse> getChatRoomById(@PathVariable Long id) {
        log.info("GET /api/chat-rooms/{}", id);
        return ResponseEntity.ok(chatRoomApplicationService.getChatRoomById(id));
    }

    /**
     * 채팅방 입장
     * POST /api/chat-rooms/{id}/join
     */
    @PostMapping("/{id}/join")
    public ResponseEntity<ChatRoomResponse> joinChatRoom(
            @PathVariable Long id,
            @RequestParam Long userId) {
        log.info("POST /api/chat-rooms/{}/join userId={}", id, userId);
        JoinChatRoomRequest request = new JoinChatRoomRequest(id, userId);
        return ResponseEntity.ok(chatRoomApplicationService.joinChatRoom(request));
    }

    /**
     * 채팅방 퇴장
     * POST /api/chat-rooms/{id}/leave
     */
    @PostMapping("/{id}/leave")
    public ResponseEntity<Void> leaveChatRoom(
            @PathVariable Long id,
            @RequestParam Long userId) {
        log.info("POST /api/chat-rooms/{}/leave userId={}", id, userId);
        chatRoomApplicationService.leaveChatRoom(id, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * 채팅방 활성 멤버 목록 조회
     * GET /api/chat-rooms/{id}/members
     */
    @GetMapping("/{id}/members")
    public ResponseEntity<List<ChatRoomMemberResponse>> getChatRoomMembers(@PathVariable Long id) {
        log.info("GET /api/chat-rooms/{}/members", id);
        return ResponseEntity.ok(chatRoomApplicationService.getActiveChatRoomMembers(id));
    }

    /**
     * 채팅방 멤버 온라인 상태 업데이트
     * PUT /api/chat-rooms/{id}/members/status
     */
    @PutMapping("/{id}/members/status")
    public ResponseEntity<Void> updateMemberStatus(
            @PathVariable Long id,
            @RequestBody UpdateActiveStatusRequest request) {
        log.info("PUT /api/chat-rooms/{}/members/status userId={}", id, request.getUserId());
        chatRoomApplicationService.updateMemberActiveStatus(id, request.getUserId(), request.isOnline());
        return ResponseEntity.ok().build();
    }

    /**
     * 멤버 하트비트 (활동 시간 갱신)
     * POST /api/chat-rooms/{id}/members/heartbeat
     */
    @PostMapping("/{id}/members/heartbeat")
    public ResponseEntity<Void> heartbeat(
            @PathVariable Long id,
            @RequestParam Long userId) {
        chatRoomApplicationService.updateMemberActivity(id, userId);
        return ResponseEntity.ok().build();
    }

    private String encodeImageToBase64(MultipartFile image) {
        String contentType = image.getContentType();
        if (contentType == null ||
                (!contentType.equals("image/jpeg") && !contentType.equals("image/png") && !contentType.equals("image/gif"))) {
            throw new IllegalArgumentException("JPG, PNG, GIF 형식만 지원합니다.");
        }
        if (image.getSize() > 5L * 1024 * 1024) {
            throw new IllegalArgumentException("이미지 크기가 5MB를 초과합니다.");
        }
        try {
            byte[] bytes = image.getBytes();
            String base64 = java.util.Base64.getEncoder().encodeToString(bytes);
            return "data:" + contentType + ";base64," + base64;
        } catch (java.io.IOException e) {
            throw new IllegalArgumentException("이미지 처리 중 오류가 발생했습니다.");
        }
    }
}
