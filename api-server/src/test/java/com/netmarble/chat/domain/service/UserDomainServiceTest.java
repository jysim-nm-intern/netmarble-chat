package com.netmarble.chat.domain.service;

import com.netmarble.chat.domain.model.User;
import com.netmarble.chat.domain.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserDomainServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserDomainService userDomainService;

    @Test
    void createUserCreatesNewUserWhenNicknameIsAvailable() {
        String nickname = "tester";
        when(userRepository.existsByNickname(nickname)).thenReturn(false);

        User user = userDomainService.createUser(nickname);

        assertEquals(nickname, user.getNickname());
    }

    @Test
    void createUserThrowsWhenNicknameAlreadyExists() {
        String nickname = "duplicate";
        when(userRepository.existsByNickname(nickname)).thenReturn(true);

        IllegalArgumentException error = assertThrows(
                IllegalArgumentException.class,
                () -> userDomainService.createUser(nickname)
        );

        assertEquals("이미 사용 중인 닉네임입니다: " + nickname, error.getMessage());
    }
}
