package com.netmarble.chat.presentation.controller;

import com.netmarble.chat.application.dto.CreateUserRequest;
import com.netmarble.chat.application.dto.UserResponse;
import com.netmarble.chat.application.service.UserApplicationService;
import com.netmarble.chat.domain.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * User REST API Controller
 */
@Slf4j
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserApplicationService userApplicationService;
    private final FileStorageService fileStorageService;

    /**
     * 새로운 사용자 생성 / 로그인
     * POST /api/users
     * Content-Type: multipart/form-data
     * - nickname     (String, 필수)
     * - profileColor (String, 선택 / hex)
     * - image        (MultipartFile, 선택 / JPG·PNG·GIF, 최대 5MB)
     */
    @PostMapping(consumes = {MediaType.MULTIPART_FORM_DATA_VALUE, MediaType.APPLICATION_FORM_URLENCODED_VALUE})
    public ResponseEntity<UserResponse> createUser(
            @RequestParam String nickname,
            @RequestParam(required = false) String profileColor,
            @RequestParam(required = false) MultipartFile image) {
        log.info("POST /api/users - Creating/logging in user with nickname: {}", nickname);

        String profileImage = null;
        if (image != null && !image.isEmpty()) {
            try {
                profileImage = fileStorageService.store(
                        image.getInputStream(), image.getContentType(),
                        image.getOriginalFilename(), image.getSize(), "profiles");
            } catch (java.io.IOException e) {
                throw new RuntimeException("파일 읽기 실패", e);
            }
        }

        CreateUserRequest request = new CreateUserRequest(nickname, profileColor, profileImage);
        UserResponse response = userApplicationService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * 사용자 ID로 조회
     * GET /api/users/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        log.info("GET /api/users/{} - Fetching user by id", id);
        UserResponse response = userApplicationService.getUserById(id);
        return ResponseEntity.ok(response);
    }

    /**
     * 닉네임으로 사용자 조회
     * GET /api/users/nickname/{nickname}
     */
    @GetMapping("/nickname/{nickname}")
    public ResponseEntity<UserResponse> getUserByNickname(@PathVariable String nickname) {
        log.info("GET /api/users/nickname/{} - Fetching user by nickname", nickname);
        UserResponse response = userApplicationService.getUserByNickname(nickname);
        return ResponseEntity.ok(response);
    }

    /**
     * 활성 사용자 목록 조회
     * GET /api/users/active
     */
    @GetMapping("/active")
    public ResponseEntity<List<UserResponse>> getActiveUsers() {
        log.info("GET /api/users/active - Fetching all active users");
        List<UserResponse> response = userApplicationService.getActiveUsers();
        return ResponseEntity.ok(response);
    }

    /**
     * 닉네임 사용 가능 여부 확인
     * GET /api/users/check-nickname?nickname={nickname}
     */
    @GetMapping("/check-nickname")
    public ResponseEntity<Map<String, Boolean>> checkNicknameAvailability(
            @RequestParam String nickname) {
        log.info("GET /api/users/check-nickname - Checking availability for: {}", nickname);
        boolean available = userApplicationService.isNicknameAvailable(nickname);
        Map<String, Boolean> response = new HashMap<>();
        response.put("available", available);
        return ResponseEntity.ok(response);
    }

    /**
     * 사용자 활동 시간 업데이트
     * PUT /api/users/{id}/activity
     */
    @PutMapping("/{id}/activity")
    public ResponseEntity<Void> updateUserActivity(@PathVariable Long id) {
        log.info("PUT /api/users/{}/activity - Updating user activity", id);
        userApplicationService.updateUserActivity(id);
        return ResponseEntity.noContent().build();
    }
}
