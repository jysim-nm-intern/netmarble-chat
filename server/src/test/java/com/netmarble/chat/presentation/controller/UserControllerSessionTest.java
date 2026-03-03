package com.netmarble.chat.presentation.controller;

import com.netmarble.chat.application.dto.UserResponse;
import com.netmarble.chat.application.service.ChatRoomApplicationService;
import com.netmarble.chat.application.service.MessageApplicationService;
import com.netmarble.chat.application.service.UserApplicationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDateTime;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 세션 기반 인증 테스트
 * - 로그인 성공 시 세션에 userId 저장 확인
 * - 로그아웃 시 세션 무효화 확인
 * - 보호 엔드포인트 세션 없이 접근 → 401 확인
 */
@WebMvcTest(controllers = {UserController.class, ChatRoomController.class})
class UserControllerSessionTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserApplicationService userApplicationService;

    @MockBean
    private ChatRoomApplicationService chatRoomApplicationService;

    @MockBean
    private MessageApplicationService messageApplicationService;

    @MockBean
    private SimpMessagingTemplate messagingTemplate;

    // --- 로그인 ---

    @Test
    void 로그인_성공시_201_응답_및_세션에_userId_저장() throws Exception {
        UserResponse response = new UserResponse(
                42L, "testUser", LocalDateTime.now(), LocalDateTime.now(),
                true, "#FF5733", null);
        when(userApplicationService.createUser(any())).thenReturn(response);

        MvcResult result = mockMvc.perform(
                        post("/api/users")
                                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                                .param("nickname", "testUser"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.nickname").value("testUser"))
                .andReturn();

        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        assertThat(session).isNotNull();
        assertThat(Objects.requireNonNull(session).getAttribute("userId")).isEqualTo(42L);
    }

    // --- 로그아웃 ---

    @Test
    void 로그아웃_시_204_응답_및_세션_무효화() throws Exception {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("userId", 42L);

        mockMvc.perform(
                        post("/api/users/logout")
                                .session(session))
                .andExpect(status().isNoContent());

        assertThat(session.isInvalid()).isTrue();
    }

    @Test
    void 세션_없이_로그아웃_호출해도_204_응답() throws Exception {
        mockMvc.perform(post("/api/users/logout"))
                .andExpect(status().isNoContent());
    }

    // --- 보호 엔드포인트 인증 검사 ---

    @Test
    void 세션_없이_채팅방_입장_요청시_401_응답() throws Exception {
        mockMvc.perform(post("/api/chat-rooms/1/join"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Unauthorized"));
    }

    @Test
    void 세션_없이_채팅방_퇴장_요청시_401_응답() throws Exception {
        mockMvc.perform(post("/api/chat-rooms/1/leave"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Unauthorized"));
    }
}
