package com.netmarble.chat.presentation.controller;

import com.netmarble.chat.application.dto.MessageResponse;
import com.netmarble.chat.application.service.ChatRoomApplicationService;
import com.netmarble.chat.application.service.MessageApplicationService;
import com.netmarble.chat.application.service.ReadStatusApplicationService;
import com.netmarble.chat.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * ChatController 검색 엔드포인트 테스트
 */
@WebMvcTest(ChatController.class)
class MessageSearchControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MessageApplicationService messageApplicationService;

    @MockBean
    private ReadStatusApplicationService readStatusApplicationService;

    @MockBean
    private ChatRoomApplicationService chatRoomApplicationService;

    @MockBean
    private UserRepository userRepository;

    private List<MessageResponse> mockSearchResults;

    @BeforeEach
    void setUp() {
        // 테스트 데이터 생성
        MessageResponse msg1 = MessageResponse.builder()
                .id(1L)
                .chatRoomId(1L)
                .senderId(1L)
                .senderNickname("alice")
                .content("hello world")
                .type("TEXT")
                .sentAt(LocalDateTime.now())
                .deleted(false)
                .unreadCount(0)
                .build();

        MessageResponse msg2 = MessageResponse.builder()
                .id(2L)
                .chatRoomId(1L)
                .senderId(2L)
                .senderNickname("bob")
                .content("hello there")
                .type("TEXT")
                .sentAt(LocalDateTime.now())
                .deleted(false)
                .unreadCount(0)
                .build();

        mockSearchResults = Arrays.asList(msg1, msg2);
    }

    @Test
    void searchMessages_WithValidKeyword_Returns200() throws Exception {
        // Given
        Long chatRoomId = 1L;
        String keyword = "hello";
        
        when(messageApplicationService.searchMessages(chatRoomId, keyword))
                .thenReturn(mockSearchResults);

        // When & Then
        mockMvc.perform(get("/api/chat/chat-rooms/{chatRoomId}/messages/search", chatRoomId)
                        .param("keyword", keyword))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].content").value("hello world"))
                .andExpect(jsonPath("$[1].content").value("hello there"));

        verify(messageApplicationService).searchMessages(chatRoomId, keyword);
    }

    @Test
    void searchMessages_WithEmptyKeyword_Returns400() throws Exception {
        // Given
        Long chatRoomId = 1L;
        String keyword = "";

        when(messageApplicationService.searchMessages(anyLong(), anyString()))
                .thenThrow(new IllegalArgumentException("검색어는 비어있을 수 없습니다."));

        // When & Then
        mockMvc.perform(get("/api/chat/chat-rooms/{chatRoomId}/messages/search", chatRoomId)
                        .param("keyword", keyword))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void searchMessages_WithNonExistentChatRoom_Returns400() throws Exception {
        // Given
        Long chatRoomId = 999L;
        String keyword = "hello";

        when(messageApplicationService.searchMessages(chatRoomId, keyword))
                .thenThrow(new IllegalArgumentException("채팅방을 찾을 수 없습니다: " + chatRoomId));

        // When & Then
        mockMvc.perform(get("/api/chat/chat-rooms/{chatRoomId}/messages/search", chatRoomId)
                        .param("keyword", keyword))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void searchMessages_WithNoResults_Returns200WithEmptyList() throws Exception {
        // Given
        Long chatRoomId = 1L;
        String keyword = "nonexistent";

        when(messageApplicationService.searchMessages(chatRoomId, keyword))
                .thenReturn(Arrays.asList());

        // When & Then
        mockMvc.perform(get("/api/chat/chat-rooms/{chatRoomId}/messages/search", chatRoomId)
                        .param("keyword", keyword))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void searchMessages_WithSpecialCharacters_Returns200() throws Exception {
        // Given
        Long chatRoomId = 1L;
        String keyword = "$100";

        MessageResponse msg = MessageResponse.builder()
                .id(1L)
                .chatRoomId(1L)
                .senderId(1L)
                .senderNickname("alice")
                .content("price: $100")
                .type("TEXT")
                .sentAt(LocalDateTime.now())
                .deleted(false)
                .unreadCount(0)
                .build();

        when(messageApplicationService.searchMessages(chatRoomId, keyword))
                .thenReturn(Arrays.asList(msg));

        // When & Then
        mockMvc.perform(get("/api/chat/chat-rooms/{chatRoomId}/messages/search", chatRoomId)
                        .param("keyword", keyword))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].content").value("price: $100"));
    }
}
