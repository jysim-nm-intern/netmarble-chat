package com.netmarble.chat.infrastructure.persistence;

import com.netmarble.chat.domain.model.User;
import com.netmarble.chat.domain.repository.UserRepository;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 사용자 리포지토리 통합 테스트 (로컬 MySQL)
 * 사전 조건: MySQL이 localhost:3306에서 실행 중이어야 합니다.
 * DB 설정: src/test/resources/application.properties (netmarble_chat_test, create-drop)
 */
@Tag("integration")
@SpringBootTest
class UserRepositoryIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    void saveAndFindByNicknameWorks() {
        User saved = userRepository.save(new User("integrationUser"));

        assertTrue(saved.getId() > 0);
        assertEquals("integrationUser", userRepository.findByNickname("integrationUser").orElseThrow().getNickname());
    }
}
