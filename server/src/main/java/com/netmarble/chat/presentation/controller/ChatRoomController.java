package com.netmarble.chat.presentation.controller;

import com.netmarble.chat.application.dto.*;
import com.netmarble.chat.application.service.ChatRoomApplicationService;
import com.netmarble.chat.application.service.MessageApplicationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * ChatRoom REST API Controller
 */
@Slf4j
@RestController
@RequestMapping("/api/chat-rooms")
@RequiredArgsConstructor
public class ChatRoomController {

    private final ChatRoomApplicationService chatRoomApplicationService;
    private final MessageApplicationService messageApplicationService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 채팅방 생성
     * POST /api/chat-rooms
     * Content-Type: multipart/form-data
     * - name (String, 필수)
     * - creatorId (Long, 필수)
     * - image (MultipartFile, 선택 / JPG·PNG·GIF, 최대 5MB)
     */
    @PostMapping(consumes = {MediaType.MULTIPART_FORM_DATA_VALUE, MediaType.APPLICATION_FORM_URLENCODED_VALUE})
    public ResponseEntity<ChatRoomResponse> createChatRoom(
            @RequestParam String name,
            @RequestParam Long creatorId,
            @RequestParam(required = false) MultipartFile image) {
        log.info("POST /api/chat-rooms - Creating chat room: {}", name);

        String imageUrl = null;
        if (image != null && !image.isEmpty()) {
            imageUrl = encodeImageToBase64(image);
        }

        CreateChatRoomRequest request = new CreateChatRoomRequest(name, creatorId, imageUrl);
        ChatRoomResponse response = chatRoomApplicationService.createChatRoom(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * 이미지 파일을 Base64 Data URL로 변환
     */
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

    /**
     * 활성 채팅방 목록 조회 (읽지 않은 메시지 개수 포함)
     * GET /api/chat-rooms?userId=
     */
    @GetMapping
    public ResponseEntity<List<ChatRoomResponse>> getAllActiveChatRooms(
            @RequestParam(required = false) Long userId) {
        log.info("GET /api/chat-rooms - Fetching all active chat rooms (userId={})", userId);
        List<ChatRoomResponse> response = chatRoomApplicationService.getAllActiveChatRooms(userId);
        return ResponseEntity.ok(response);
    }

    /**
     * 채팅방 상세 조회
     * GET /api/chat-rooms/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ChatRoomResponse> getChatRoomById(@PathVariable Long id) {
        log.info("GET /api/chat-rooms/{} - Fetching chat room", id);
        ChatRoomResponse response = chatRoomApplicationService.getChatRoomById(id);
        return ResponseEntity.ok(response);
    }

    /**
     * 채팅방 입장
     * POST /api/chat-rooms/{id}/join
     */
    @PostMapping("/{id}/join")
    public ResponseEntity<ChatRoomResponse> joinChatRoom(
            @PathVariable Long id,
            @RequestParam Long userId) {
        log.info("POST /api/chat-rooms/{}/join - User {} joining", id, userId);
        JoinChatRoomRequest request = new JoinChatRoomRequest(id, userId);
        ChatRoomResponse response = chatRoomApplicationService.joinChatRoom(request);
        return ResponseEntity.ok(response);
    }

    /**
     * 채팅방 퇴장
     * POST /api/chat-rooms/{id}/leave
     */
    @PostMapping("/{id}/leave")
    public ResponseEntity<Void> leaveChatRoom(
            @PathVariable Long id,
            @RequestParam Long userId) {
        log.info("POST /api/chat-rooms/{}/leave - User {} leaving", id, userId);
        chatRoomApplicationService.leaveChatRoom(id, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * 채팅방 멤버 목록 조회 (활성 멤버)
     * GET /api/chat-rooms/{id}/members
     */
    @GetMapping("/{id}/members")
    public ResponseEntity<List<ChatRoomMemberResponse>> getChatRoomMembers(@PathVariable Long id) {
        log.info("GET /api/chat-rooms/{}/members - Fetching active members", id);
        List<ChatRoomMemberResponse> response = chatRoomApplicationService.getActiveChatRoomMembers(id);
        return ResponseEntity.ok(response);
    }
    
    /**
     * 채팅방 멤버 활성 상태 업데이트
     * PUT /api/chat-rooms/{id}/members/status
     */
    @PutMapping("/{id}/members/status")
    public ResponseEntity<Void> updateMemberStatus(
            @PathVariable Long id,
            @RequestBody UpdateActiveStatusRequest request) {
        log.info("PUT /api/chat-rooms/{}/members/status - Updating status for user {}", 
                 id, request.getUserId());
        chatRoomApplicationService.updateMemberActiveStatus(id, request.getUserId(), request.isOnline());
        return ResponseEntity.ok().build();
    }
    
    /**
     * 채팅방 멤버 활동 업데이트 (하트비트)
     * POST /api/chat-rooms/{id}/members/heartbeat
     */
    @PostMapping("/{id}/members/heartbeat")
    public ResponseEntity<Void> heartbeat(
            @PathVariable Long id,
            @RequestParam Long userId) {
        chatRoomApplicationService.updateMemberActivity(id, userId);
        return ResponseEntity.ok().build();
    }

    /**
     * 메시지 전송 (REST API)
     * POST /api/chat-rooms/{id}/messages
     * Body: { chatRoomId, senderId, content, messageType, fileName }
     */
    /**
     * 메시지 전송 (REST API)
     * POST /api/chat-rooms/{id}/messages
     * Body: { chatRoomId, senderId, content, messageType, fileName }
     */
    @PostMapping("/{id}/messages")
    public ResponseEntity<MessageResponse> sendMessage(
            @PathVariable Long id,
            @RequestBody SendMessageRequest request) {
        log.info("POST /api/chat-rooms/{}/messages - Sending message from user {}", 
                 id, request.getSenderId());
        
        // URL 경로의 ID가 요청의 chatRoomId와 일치하는지 검증
        if (request.getChatRoomId() == null) {
            request.setChatRoomId(id);
        } else if (!request.getChatRoomId().equals(id)) {
            log.warn("URL path ID {} does not match request chatRoomId {}", id, request.getChatRoomId());
        }
        
        // 메시지 전송
        MessageResponse response = messageApplicationService.sendMessage(request);
        
        // WebSocket으로 브로드캐스트
        try {
            messagingTemplate.convertAndSend(
                "/topic/chatroom/" + id,
                response
            );
            log.info("Message broadcasted to /topic/chatroom/{}", id);
        } catch (Exception e) {
            log.warn("Failed to broadcast message via WebSocket", e);
        }
        
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * 이미지 파일 업로드 (multipart/form-data)
     * POST /api/chat-rooms/{id}/messages/upload
     */
    @PostMapping("/{id}/messages/upload")
    public ResponseEntity<MessageResponse> uploadImage(
            @PathVariable Long id,
            @RequestParam Long userId,
            @RequestParam(required = false, defaultValue = "0") Long chatRoomId,
            @RequestParam MultipartFile file) {
        try {
            log.info("POST /api/chat-rooms/{}/messages/upload - User {} uploading image {}", 
                     id, userId, file.getOriginalFilename());
            
            // 파일 유효성 검증
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            
            // 이미지 파일만 허용
            String contentType = file.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                throw new IllegalArgumentException("이미지 파일만 업로드 가능합니다.");
            }
            
            // 파일 크기 검증 (7.5MB)
            if (file.getSize() > 7.5 * 1024 * 1024) {
                throw new IllegalArgumentException("파일 크기가 7.5MB를 초과합니다.");
            }
            
            // 이미지를 Base64로 변환
            byte[] fileBytes = file.getBytes();
            String base64Image = java.util.Base64.getEncoder().encodeToString(fileBytes);
            
            // 메시지 요청 생성
            SendMessageRequest request = new SendMessageRequest();
            request.setChatRoomId(id);
            request.setSenderId(userId);
            request.setContent("data:image/" + getImageFormat(file.getOriginalFilename()) + ";base64," + base64Image);
            request.setMessageType("IMAGE");
            request.setFileName(file.getOriginalFilename());
            
            // 메시지 전송
            MessageResponse response = messageApplicationService.sendMessage(request);
            
            // WebSocket으로 브로드캐스트
            try {
                messagingTemplate.convertAndSend(
                    "/topic/chatroom/" + id,
                    response
                );
                log.info("Image message broadcasted to /topic/chatroom/{}", id);
            } catch (Exception e) {
                log.warn("Failed to broadcast image message via WebSocket", e);
            }
            
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            log.error("Error uploading image", e);
            throw new IllegalArgumentException(e.getMessage());
        }
    }
    
    /**
     * 파일명에서 이미지 형식 추출
     */
    private String getImageFormat(String filename) {
        if (filename == null) {
            return "jpg";
        }
        String extension = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
        switch (extension) {
            case "jpg", "jpeg" -> { return "jpeg"; }
            case "png" -> { return "png"; }
            case "gif" -> { return "gif"; }
            case "webp" -> { return "webp"; }
            default -> { return "jpeg"; }
        }
    }

    /**
     * 메시지 검색
     * GET /api/chat-rooms/{id}/messages/search?keyword=검색어
     */
    @GetMapping("/{id}/messages/search")
    public ResponseEntity<List<MessageResponse>> searchMessages(
            @PathVariable Long id,
            @RequestParam String keyword) {
        log.info("GET /api/chat-rooms/{}/messages/search?keyword={}", id, keyword);
        List<MessageResponse> results = messageApplicationService.searchMessages(id, keyword);
        return ResponseEntity.ok(results);
    }
}
