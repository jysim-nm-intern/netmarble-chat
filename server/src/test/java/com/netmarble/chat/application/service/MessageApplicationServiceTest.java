package com.netmarble.chat.application.service;

import com.netmarble.chat.application.dto.MessageResponse;
import com.netmarble.chat.domain.model.ChatRoom;
import com.netmarble.chat.domain.model.ChatRoomMember;
import com.netmarble.chat.domain.model.Message;
import com.netmarble.chat.domain.model.User;
import com.netmarble.chat.domain.repository.AttachmentRepository;
import com.netmarble.chat.domain.repository.ChatRoomMemberRepository;
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
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * MessageApplicationService 단위 테스트
 * 관련 SPEC: SPEC-ROOM-003 (입장 시점 이후 메시지 조회)
 */
@ExtendWith(MockitoExtension.class)
class MessageApplicationServiceTest {

    @Mock private MessageRepository messageRepository;
    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private UserRepository userRepository;
    @Mock private AttachmentRepository attachmentRepository;
    @Mock private ChatRoomMemberRepository chatRoomMemberRepository;

    @InjectMocks
    private MessageApplicationService messageApplicationService;

    private User sender;
    private ChatRoom chatRoom;
    private ChatRoomMember member;
    private Message oldMessage;
    private Message newMessage;

    @BeforeEach
    void setUp() throws Exception {
        sender = new User("alice");
        setId(sender, 1L);

        chatRoom = new ChatRoom("테스트방", null, sender);
        setId(chatRoom, 10L);

        // 멤버의 입장 시점: 1시간 전
        member = new ChatRoomMember(chatRoom, sender);
        setField(member, "joinedAt", LocalDateTime.now().minusHours(1));
        setId(member, 100L);

        // 2시간 전 메시지 (입장 이전)
        oldMessage = new Message(chatRoom, sender, "오래된 메시지", Message.MessageType.TEXT);
        setId(oldMessage, 1L);
        setField(oldMessage, "sentAt", LocalDateTime.now().minusHours(2));

        // 30분 전 메시지 (입장 이후)
        newMessage = new Message(chatRoom, sender, "새 메시지", Message.MessageType.TEXT);
        setId(newMessage, 2L);
        setField(newMessage, "sentAt", LocalDateTime.now().minusMinutes(30));
    }

    private void setId(Object obj, Long id) throws Exception {
        setField(obj, "id", id);
    }

    private void setField(Object obj, String fieldName, Object value) throws Exception {
        Field field = findField(obj.getClass(), fieldName);
        field.setAccessible(true);
        field.set(obj, value);
    }

    private Field findField(Class<?> clazz, String fieldName) throws NoSuchFieldException {
        try {
            return clazz.getDeclaredField(fieldName);
        } catch (NoSuchFieldException e) {
            if (clazz.getSuperclass() != null) {
                return findField(clazz.getSuperclass(), fieldName);
            }
            throw e;
        }
    }

    // ─── BE-MSG-SVC-JOIN-001 ────────────────────────────────────────────────
    // SPEC-ROOM-003 AC-ROOM-003-9
    @Test
    void getChatRoomMessages_userId_있으면_입장_시점_이후_메시지만_반환() {
        // given
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(chatRoomMemberRepository.findActiveByChatRoomIdAndUserId(10L, 1L))
            .thenReturn(Optional.of(member));
        when(messageRepository.findByChatRoomIdAndSentAtAfterOrderBySentAtAsc(eq(10L), any(LocalDateTime.class)))
            .thenReturn(List.of(newMessage));

        // when
        List<MessageResponse> result = messageApplicationService.getChatRoomMessages(10L, 1L);

        // then
        assertEquals(1, result.size());
        assertEquals(2L, result.get(0).getId());
        verify(messageRepository).findByChatRoomIdAndSentAtAfterOrderBySentAtAsc(eq(10L), any(LocalDateTime.class));
        verify(messageRepository, never()).findByChatRoomIdOrderBySentAtAsc(anyLong());
    }

    // ─── BE-MSG-SVC-JOIN-002 ────────────────────────────────────────────────
    @Test
    void getChatRoomMessages_userId_없으면_전체_메시지_반환() {
        // given
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.findByChatRoomIdOrderBySentAtAsc(10L))
            .thenReturn(List.of(oldMessage, newMessage));

        // when
        List<MessageResponse> result = messageApplicationService.getChatRoomMessages(10L, null);

        // then
        assertEquals(2, result.size());
        verify(messageRepository).findByChatRoomIdOrderBySentAtAsc(10L);
        verify(messageRepository, never()).findByChatRoomIdAndSentAtAfterOrderBySentAtAsc(anyLong(), any());
        verify(chatRoomMemberRepository, never()).findActiveByChatRoomIdAndUserId(anyLong(), anyLong());
    }

    // ─── BE-MSG-SVC-JOIN-003 ────────────────────────────────────────────────
    @Test
    void getChatRoomMessages_활성_멤버가_아니면_빈_목록_반환() {
        // given
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(chatRoomMemberRepository.findActiveByChatRoomIdAndUserId(10L, 99L))
            .thenReturn(Optional.empty());

        // when
        List<MessageResponse> result = messageApplicationService.getChatRoomMessages(10L, 99L);

        // then
        assertTrue(result.isEmpty());
        verify(messageRepository, never()).findByChatRoomIdAndSentAtAfterOrderBySentAtAsc(anyLong(), any());
    }

    // ─── BE-MSG-SVC-JOIN-004 ────────────────────────────────────────────────
    @Test
    void getChatRoomMessages_채팅방_없으면_예외() {
        // given
        when(chatRoomRepository.findById(999L)).thenReturn(Optional.empty());

        // when & then
        assertThrows(IllegalArgumentException.class,
            () -> messageApplicationService.getChatRoomMessages(999L, 1L));
    }

    // ─── BE-MSG-SVC-JOIN-005 ────────────────────────────────────────────────
    @Test
    void getChatRoomMessages_입장_시점_이후_메시지_없으면_빈_목록_반환() {
        // given - 입장 시점 이후 메시지가 없는 경우
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(chatRoomMemberRepository.findActiveByChatRoomIdAndUserId(10L, 1L))
            .thenReturn(Optional.of(member));
        when(messageRepository.findByChatRoomIdAndSentAtAfterOrderBySentAtAsc(eq(10L), any(LocalDateTime.class)))
            .thenReturn(List.of());

        // when
        List<MessageResponse> result = messageApplicationService.getChatRoomMessages(10L, 1L);

        // then
        assertTrue(result.isEmpty());
    }
}
