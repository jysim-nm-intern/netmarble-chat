package com.netmarble.chat.application.service;

import com.netmarble.chat.application.dto.UnreadCountResponse;
import com.netmarble.chat.domain.model.ChatRoom;
import com.netmarble.chat.domain.model.ChatRoomMember;
import com.netmarble.chat.domain.model.Message;
import com.netmarble.chat.domain.model.User;
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
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReadStatusApplicationServiceTest {

    @Mock
    private MessageRepository messageRepository;
    @Mock
    private ChatRoomRepository chatRoomRepository;
    @Mock
    private ChatRoomMemberRepository chatRoomMemberRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private ReadStatusApplicationService readStatusApplicationService;

    private User user1;
    private User user2;
    private ChatRoom chatRoom;

    @BeforeEach
    void setUp() throws Exception {
        user1 = new User("alice");
        setId(user1, 1L);
        user2 = new User("bob");
        setId(user2, 2L);
        chatRoom = new ChatRoom("테스트방", null, user1);
        setId(chatRoom, 10L);
        chatRoom.addMember(user2);
    }

    private void setId(Object obj, Long id) throws Exception {
        Field field = obj.getClass().getDeclaredField("id");
        field.setAccessible(true);
        field.set(obj, id);
    }

    private Message makeMessage(Long id, ChatRoom room, User sender, String content) throws Exception {
        Message msg = new Message(room, sender, content);
        setId(msg, id);
        return msg;
    }

    // ─── markAsRead ───────────────────────────────────────────────────────────

    @Test
    void markAsRead_성공() throws Exception {
        Message lastMsg = makeMessage(5L, chatRoom, user2, "안녕");
        ChatRoomMember member = chatRoom.getMembers().stream()
                .filter(m -> m.getUser().getId().equals(1L))
                .findFirst().orElseThrow();

        when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
        when(messageRepository.findLastByChatRoomId(10L)).thenReturn(Optional.of(lastMsg));
        when(chatRoomMemberRepository.findActiveByChatRoomIdAndUserId(10L, 1L))
                .thenReturn(Optional.of(member));
        when(chatRoomMemberRepository.save(any(ChatRoomMember.class))).thenReturn(member);

        assertDoesNotThrow(() -> readStatusApplicationService.markAsRead(1L, 10L));

        verify(chatRoomMemberRepository).save(any(ChatRoomMember.class));
        verify(messagingTemplate).convertAndSend(eq("/topic/chatroom/10/read-status"), any(Object.class));
    }

    @Test
    void markAsRead_메시지_없으면_아무것도_안함() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
        when(messageRepository.findLastByChatRoomId(10L)).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> readStatusApplicationService.markAsRead(1L, 10L));

        verify(chatRoomMemberRepository, never()).save(any());
        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }

    @Test
    void markAsRead_사용자_없으면_예외() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> readStatusApplicationService.markAsRead(999L, 10L));
    }

    @Test
    void markAsRead_멤버_없으면_예외() throws Exception {
        Message lastMsg = makeMessage(5L, chatRoom, user2, "안녕");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user1));
        when(messageRepository.findLastByChatRoomId(10L)).thenReturn(Optional.of(lastMsg));
        when(chatRoomMemberRepository.findActiveByChatRoomIdAndUserId(10L, 1L))
                .thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> readStatusApplicationService.markAsRead(1L, 10L));
    }

    // ─── getUnreadCount ───────────────────────────────────────────────────────

    @Test
    void getUnreadCount_채팅방_없으면_예외() {
        when(chatRoomRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> readStatusApplicationService.getUnreadCount(1L, 999L));
    }

    @Test
    void getUnreadCount_멤버_아닌_사용자는_0() throws Exception {
        User stranger = new User("charlie");
        setId(stranger, 3L);
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));

        long count = readStatusApplicationService.getUnreadCount(3L, 10L);

        assertEquals(0, count);
    }

    @Test
    void getUnreadCount_한번도_읽지_않은_경우_타인_메시지_카운트() throws Exception {
        Message msg1 = makeMessage(1L, chatRoom, user2, "hello");
        Message msg2 = makeMessage(2L, chatRoom, user2, "world");

        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.findByChatRoomIdOrderBySentAtAsc(10L))
                .thenReturn(List.of(msg1, msg2));

        long count = readStatusApplicationService.getUnreadCount(1L, 10L);

        assertEquals(2, count);
    }

    @Test
    void getUnreadCount_자신이_보낸_메시지는_제외() throws Exception {
        Message myMsg = makeMessage(1L, chatRoom, user1, "내 메시지");
        Message otherMsg = makeMessage(2L, chatRoom, user2, "상대 메시지");

        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.findByChatRoomIdOrderBySentAtAsc(10L))
                .thenReturn(List.of(myMsg, otherMsg));

        long count = readStatusApplicationService.getUnreadCount(1L, 10L);

        assertEquals(1, count);
    }

    @Test
    void getUnreadCount_마지막_읽은_메시지_이후만_카운트() throws Exception {
        Message msg1 = makeMessage(1L, chatRoom, user2, "읽은 메시지");
        Message msg2 = makeMessage(2L, chatRoom, user2, "안읽은 메시지1");
        Message msg3 = makeMessage(3L, chatRoom, user2, "안읽은 메시지2");

        // user1의 멤버 객체를 찾아서 msg1을 읽음 처리
        ChatRoomMember member1 = chatRoom.getMembers().stream()
                .filter(m -> m.getUser().getId().equals(1L))
                .findFirst().orElseThrow();
        member1.updateLastReadMessage(msg1);

        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.findByChatRoomIdOrderBySentAtAsc(10L))
                .thenReturn(List.of(msg1, msg2, msg3));

        long count = readStatusApplicationService.getUnreadCount(1L, 10L);

        assertEquals(2, count);
    }

    // ─── getAllUnreadCounts ───────────────────────────────────────────────────

    @Test
    void getAllUnreadCounts_참여중인_방만_포함() throws Exception {
        when(chatRoomRepository.findAllActive()).thenReturn(List.of(chatRoom));
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.findByChatRoomIdOrderBySentAtAsc(10L)).thenReturn(List.of());

        Map<Long, Long> result = readStatusApplicationService.getAllUnreadCounts(1L);

        assertTrue(result.containsKey(10L));
    }

    @Test
    void getAllUnreadCounts_미참여_방은_제외() {
        when(chatRoomRepository.findAllActive()).thenReturn(List.of(chatRoom));

        Map<Long, Long> result = readStatusApplicationService.getAllUnreadCounts(99L);

        assertFalse(result.containsKey(10L));
    }

    // ─── getUnreadCountsForActiveChatRooms ───────────────────────────────────

    @Test
    void getUnreadCountsForActiveChatRooms_참여방_목록_반환() throws Exception {
        when(chatRoomRepository.findAllActive()).thenReturn(List.of(chatRoom));
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.findByChatRoomIdOrderBySentAtAsc(10L)).thenReturn(List.of());

        List<UnreadCountResponse> result =
                readStatusApplicationService.getUnreadCountsForActiveChatRooms(1L);

        assertEquals(1, result.size());
        assertEquals(10L, result.get(0).getChatRoomId());
    }

    @Test
    void getUnreadCountsForActiveChatRooms_미참여_방_제외() {
        when(chatRoomRepository.findAllActive()).thenReturn(List.of(chatRoom));

        List<UnreadCountResponse> result =
                readStatusApplicationService.getUnreadCountsForActiveChatRooms(99L);

        assertTrue(result.isEmpty());
    }
}
