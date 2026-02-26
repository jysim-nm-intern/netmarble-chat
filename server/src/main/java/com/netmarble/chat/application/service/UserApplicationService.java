package com.netmarble.chat.application.service;

import com.netmarble.chat.application.dto.CreateUserRequest;
import com.netmarble.chat.application.dto.UserResponse;
import com.netmarble.chat.domain.model.User;
import com.netmarble.chat.domain.repository.UserRepository;
import com.netmarble.chat.domain.service.UserDomainService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * User 애플리케이션 서비스
 * 유즈케이스를 조율하고 트랜잭션을 관리
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserApplicationService {

    private final UserRepository userRepository;
    private final UserDomainService userDomainService;

    /**
     * 새로운 사용자 생성 또는 기존 사용자 로그인
     */
    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        log.info("Creating or logging in user with nickname: {}", request.getNickname());
        
        // 기존 닉네임이 있으면 해당 사용자 반환
        return userRepository.findByNickname(request.getNickname())
            .map(existingUser -> {
                log.info("User already exists, logging in: id={}, nickname={}",
                         existingUser.getId(), existingUser.getNickname());
                // 활동 시간 업데이트, 프로필 색상 및 이미지 갱신 후 저장
                existingUser.updateLastActive();
                existingUser.updateProfileColor(request.getProfileColor());
                existingUser.updateProfileImage(request.getProfileImage());
                User updated = userRepository.save(existingUser);
                return UserResponse.from(updated);
            })
            .orElseGet(() -> {
                // 새로운 사용자 생성
                log.info("Creating new user with nickname: {}", request.getNickname());
                User user = new User(request.getNickname(), request.getProfileColor(), request.getProfileImage());
                User savedUser = userRepository.save(user);
                log.info("User created successfully: id={}, nickname={}", 
                         savedUser.getId(), savedUser.getNickname());
                return UserResponse.from(savedUser);
            });
    }

    /**
     * 사용자 ID로 조회
     */
    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + id));
        return UserResponse.from(user);
    }

    /**
     * 닉네임으로 조회
     */
    public UserResponse getUserByNickname(String nickname) {
        User user = userRepository.findByNickname(nickname)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + nickname));
        return UserResponse.from(user);
    }

    /**
     * 활성 사용자 목록 조회
     */
    public List<UserResponse> getActiveUsers() {
        return userRepository.findAllActiveUsers().stream()
            .map(UserResponse::from)
            .collect(Collectors.toList());
    }

    /**
     * 닉네임 중복 확인
     */
    public boolean isNicknameAvailable(String nickname) {
        return !userRepository.existsByNickname(nickname);
    }

    /**
     * 사용자 활동 시간 업데이트
     */
    @Transactional
    public void updateUserActivity(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + userId));
        user.updateLastActive();
    }
}
