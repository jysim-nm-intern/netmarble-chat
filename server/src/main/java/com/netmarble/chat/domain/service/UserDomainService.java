package com.netmarble.chat.domain.service;

import com.netmarble.chat.domain.model.User;
import com.netmarble.chat.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * User 도메인 서비스
 * 도메인 로직 중 여러 엔티티에 걸친 비즈니스 규칙을 처리
 */
@Service
@RequiredArgsConstructor
public class UserDomainService {

    private final UserRepository userRepository;

    /**
     * 닉네임 중복 확인
     */
    public void validateNicknameUniqueness(String nickname) {
        if (userRepository.existsByNickname(nickname)) {
            throw new IllegalArgumentException("이미 사용 중인 닉네임입니다: " + nickname);
        }
    }

    /**
     * 새로운 사용자 생성
     */
    public User createUser(String nickname) {
        validateNicknameUniqueness(nickname);
        User user = new User(nickname);
        return user;
    }
}
