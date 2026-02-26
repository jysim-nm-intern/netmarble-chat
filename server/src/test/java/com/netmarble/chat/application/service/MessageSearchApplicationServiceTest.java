package com.netmarble.chat.application.service;

import com.netmarble.chat.application.dto.MessageResponse;
import com.netmarble.chat.domain.model.ChatRoom;
import com.netmarble.chat.domain.model.Message;
import com.netmarble.chat.domain.model.User;
import com.netmarble.chat.domain.repository.AttachmentRepository;
import com.netmarble.chat.domain.repository.ChatRoomRepository;
import com.netmarble.chat.domain.repository.MessageRepository;
import com.netmarble.chat.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * MessageApplicationService 검색 메서드 단위 테스트
 */
@ExtendWith(MockitoExtension.class)
class MessageSearchApplicationServiceTest {

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private ChatRoomRepository chatRoomRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AttachmentRepository attachmentRepository;

    @InjectMocks
    private MessageApplicationService messageApplicationService;

    private ChatRoom chatRoom;
    private User user1;

    @BeforeEach
    void setUp() throws Exception {
        user1 = new User("alice");
        setId(user1, 1L);
        chatRoom = new ChatRoom("테스트방", "설명", user1);
        setId(chatRoom, 1L);
    }

    // DB 저장 없이 ID를 주입하기 위한 리플렉션 헬퍼
    private void setId(Object obj, Long id) throws Exception {
        Field field = obj.getClass().getDeclaredField("id");
        field.setAccessible(true);
        field.set(obj, id);
    }

    @Test
    void searchMessages_WithValidKeyword_ReturnsResults() {
        // Given
        Long chatRoomId = 1L;
        String keyword = "hello";
        
        Message msg1 = new Message(chatRoom, user1, "hello world");
        Message msg2 = new Message(chatRoom, user1, "hello there");
        List<Message> searchResults = Arrays.asList(msg1, msg2);

        when(chatRoomRepository.findById(chatRoomId)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.searchByChatRoomIdAndKeyword(chatRoomId, keyword))
                .thenReturn(searchResults);

        // When
        List<MessageResponse> results = messageApplicationService.searchMessages(chatRoomId, keyword);

        // Then
        assertEquals(2, results.size());
        assertEquals("hello world", results.get(0).getContent());
        assertEquals("hello there", results.get(1).getContent());
        verify(messageRepository, times(1)).searchByChatRoomIdAndKeyword(chatRoomId, keyword);
    }

    @Test
    void searchMessages_WithEmptyKeyword_ThrowsException() {
        // Given
        Long chatRoomId = 1L;
        String keyword = "";

        // When & Then
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            messageApplicationService.searchMessages(chatRoomId, keyword);
        });

        assertEquals("검색어는 비어있을 수 없습니다.", exception.getMessage());
        verify(messageRepository, never()).searchByChatRoomIdAndKeyword(anyLong(), anyString());
    }

    @Test
    void searchMessages_WithNullKeyword_ThrowsException() {
        // Given
        Long chatRoomId = 1L;
        String keyword = null;

        // When & Then
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            messageApplicationService.searchMessages(chatRoomId, keyword);
        });

        assertEquals("검색어는 비어있을 수 없습니다.", exception.getMessage());
        verify(messageRepository, never()).searchByChatRoomIdAndKeyword(anyLong(), anyString());
    }

    @Test
    void searchMessages_WithKeywordExceedingLimit_ThrowsException() {
        // Given
        Long chatRoomId = 1L;
        String keyword = "a".repeat(256); // 256자 - 최대값을 초과

        // When & Then
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            messageApplicationService.searchMessages(chatRoomId, keyword);
        });

        assertEquals("검색어는 255자를 초과할 수 없습니다.", exception.getMessage());
        verify(messageRepository, never()).searchByChatRoomIdAndKeyword(anyLong(), anyString());
    }

    @Test
    void searchMessages_WithNonExistentChatRoom_ThrowsException() {
        // Given
        Long chatRoomId = 999L;
        String keyword = "hello";

        when(chatRoomRepository.findById(chatRoomId)).thenReturn(Optional.empty());

        // When & Then
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            messageApplicationService.searchMessages(chatRoomId, keyword);
        });

        assertEquals("채팅방을 찾을 수 없습니다: " + chatRoomId, exception.getMessage());
        verify(messageRepository, never()).searchByChatRoomIdAndKeyword(anyLong(), anyString());
    }

    @Test
    void searchMessages_WithNoResults_ReturnsEmptyList() {
        // Given
        Long chatRoomId = 1L;
        String keyword = "nonexistent";

        when(chatRoomRepository.findById(chatRoomId)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.searchByChatRoomIdAndKeyword(chatRoomId, keyword))
                .thenReturn(Arrays.asList());

        // When
        List<MessageResponse> results = messageApplicationService.searchMessages(chatRoomId, keyword);

        // Then
        assertTrue(results.isEmpty());
        verify(messageRepository, times(1)).searchByChatRoomIdAndKeyword(chatRoomId, keyword);
    }

    @Test
    void searchMessages_WithWhitespaceKeyword_TrimsAndSearches() {
        // Given
        Long chatRoomId = 1L;
        String keyword = "  hello  ";

        Message msg1 = new Message(chatRoom, user1, "hello world");
        when(chatRoomRepository.findById(chatRoomId)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.searchByChatRoomIdAndKeyword(chatRoomId, keyword.trim()))
                .thenReturn(Arrays.asList(msg1));

        // When
        List<MessageResponse> results = messageApplicationService.searchMessages(chatRoomId, keyword);

        // Then
        assertEquals(1, results.size());
        verify(messageRepository, times(1)).searchByChatRoomIdAndKeyword(chatRoomId, "hello");
    }
}
