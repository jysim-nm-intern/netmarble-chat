package com.netmarble.chat.application.service;

import com.netmarble.chat.application.dto.CreateUserRequest;
import com.netmarble.chat.application.dto.UserResponse;
import com.netmarble.chat.domain.model.User;
import com.netmarble.chat.domain.repository.UserRepository;
import com.netmarble.chat.domain.service.UserDomainService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserApplicationServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserDomainService userDomainService;

    @InjectMocks
    private UserApplicationService userApplicationService;

    private User makeUser(Long id, String nickname) throws Exception {
        User user = new User(nickname);
        Field field = User.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(user, id);
        return user;
    }

    @Test
    void createUser_신규_사용자_생성() throws Exception {
        CreateUserRequest request = new CreateUserRequest("alice", "#ff0000", null);
        User savedUser = makeUser(1L, "alice");

        when(userRepository.findByNickname("alice")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenReturn(savedUser);

        UserResponse response = userApplicationService.createUser(request);

        assertEquals("alice", response.getNickname());
        verify(userRepository).save(any(User.class));
    }

    @Test
    void createUser_기존_사용자_로그인_처리() throws Exception {
        CreateUserRequest request = new CreateUserRequest("alice", "#00ff00", null);
        User existingUser = makeUser(1L, "alice");

        when(userRepository.findByNickname("alice")).thenReturn(Optional.of(existingUser));
        when(userRepository.save(existingUser)).thenReturn(existingUser);

        UserResponse response = userApplicationService.createUser(request);

        assertEquals("alice", response.getNickname());
        verify(userRepository).save(existingUser);
        verify(userRepository, never()).save(argThat(u -> u != existingUser));
    }

    @Test
    void getUserById_존재하는_사용자_반환() throws Exception {
        User user = makeUser(1L, "alice");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        UserResponse response = userApplicationService.getUserById(1L);

        assertEquals("alice", response.getNickname());
    }

    @Test
    void getUserById_존재하지_않으면_예외() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> userApplicationService.getUserById(999L));

        assertTrue(ex.getMessage().contains("999"));
    }

    @Test
    void getUserByNickname_존재하는_사용자_반환() throws Exception {
        User user = makeUser(1L, "alice");
        when(userRepository.findByNickname("alice")).thenReturn(Optional.of(user));

        UserResponse response = userApplicationService.getUserByNickname("alice");

        assertEquals("alice", response.getNickname());
    }

    @Test
    void getUserByNickname_존재하지_않으면_예외() {
        when(userRepository.findByNickname("ghost")).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> userApplicationService.getUserByNickname("ghost"));

        assertTrue(ex.getMessage().contains("ghost"));
    }

    @Test
    void getActiveUsers_활성_사용자_목록_반환() throws Exception {
        User user1 = makeUser(1L, "alice");
        User user2 = makeUser(2L, "bob");
        when(userRepository.findAllActiveUsers()).thenReturn(List.of(user1, user2));

        List<UserResponse> result = userApplicationService.getActiveUsers();

        assertEquals(2, result.size());
    }

    @Test
    void getActiveUsers_빈_목록_반환() {
        when(userRepository.findAllActiveUsers()).thenReturn(List.of());

        List<UserResponse> result = userApplicationService.getActiveUsers();

        assertTrue(result.isEmpty());
    }

    @Test
    void isNicknameAvailable_사용가능한_닉네임() {
        when(userRepository.existsByNickname("newuser")).thenReturn(false);

        assertTrue(userApplicationService.isNicknameAvailable("newuser"));
    }

    @Test
    void isNicknameAvailable_사용중인_닉네임() {
        when(userRepository.existsByNickname("alice")).thenReturn(true);

        assertFalse(userApplicationService.isNicknameAvailable("alice"));
    }

    @Test
    void updateUserActivity_활동시간_업데이트() throws Exception {
        User user = makeUser(1L, "alice");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertDoesNotThrow(() -> userApplicationService.updateUserActivity(1L));
    }

    @Test
    void updateUserActivity_존재하지_않는_사용자_예외() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> userApplicationService.updateUserActivity(999L));
    }
}
