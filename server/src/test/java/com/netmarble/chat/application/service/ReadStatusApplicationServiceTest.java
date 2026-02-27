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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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

    private User user;
    private User otherUser;
    private ChatRoom chatRoom;

    @BeforeEach
    void setUp() throws Exception {
        user = new User("alice");
        setId(user, 1L);
        otherUser = new User("bob");
        setId(otherUser, 2L);
        chatRoom = new ChatRoom("테스트방", null, user);
        setId(chatRoom, 10L);
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

    private Message makeSystemMessage(Long id, ChatRoom room, String content) throws Exception {
        Message msg = Message.createSystemMessage(room, content);
        setId(msg, id);
        return msg;
    }

    // ─── markAsRead ───────────────────────────────────────────────────────────

    @Test
    void markAsRead_성공() throws Exception {
        Message lastMsg = makeMessage(100L, chatRoom, otherUser, "안녕하세요");
        ChatRoomMember member = new ChatRoomMember(chatRoom, user);

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(messageRepository.findLastByChatRoomId(10L)).thenReturn(Optional.of(lastMsg));
        when(chatRoomMemberRepository.findActiveByChatRoomIdAndUserId(10L, 1L))
                .thenReturn(Optional.of(member));
        when(chatRoomMemberRepository.save(any(ChatRoomMember.class))).thenReturn(member);

        assertDoesNotThrow(() -> readStatusApplicationService.markAsRead(1L, 10L));

        verify(chatRoomMemberRepository).save(member);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/chatroom/10/read-status"), any(Object.class));
    }

    @Test
    void markAsRead_사용자_없으면_예외() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> readStatusApplicationService.markAsRead(999L, 10L));
    }

    @Test
    void markAsRead_메시지_없으면_조기_종료() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(messageRepository.findLastByChatRoomId(10L)).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> readStatusApplicationService.markAsRead(1L, 10L));

        verify(chatRoomMemberRepository, never()).save(any());
        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }

    @Test
    void markAsRead_채팅방_멤버_없으면_예외() throws Exception {
        Message lastMsg = makeMessage(100L, chatRoom, otherUser, "안녕하세요");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
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
    void getUnreadCount_멤버_아니면_0_반환() {
        // chatRoom은 alice(id=1)가 생성 - bob(id=2)은 멤버가 아님
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));

        long result = readStatusApplicationService.getUnreadCount(2L, 10L);

        assertEquals(0L, result);
    }

    @Test
    void getUnreadCount_한번도_읽지_않았으면_타인_메시지_전체_반환() throws Exception {
        Message myMsg    = makeMessage(1L, chatRoom, user, "내 메시지");
        Message otherMsg = makeMessage(2L, chatRoom, otherUser, "상대 메시지");
        Message sysMsg   = makeSystemMessage(3L, chatRoom, "시스템 알림");

        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.findByChatRoomIdOrderBySentAtAsc(10L))
                .thenReturn(List.of(myMsg, otherMsg, sysMsg));

        // alice 멤버의 lastReadMessage는 초기에 null
        long result = readStatusApplicationService.getUnreadCount(1L, 10L);

        // otherMsg만 카운트됨 (sender != null && sender.id != 1)
        assertEquals(1L, result);
    }

    @Test
    void getUnreadCount_마지막_읽은_메시지_이후만_카운트() throws Exception {
        Message msg1 = makeMessage(1L, chatRoom, otherUser, "메시지1");
        Message msg2 = makeMessage(2L, chatRoom, otherUser, "메시지2");
        Message msg3 = makeMessage(3L, chatRoom, otherUser, "메시지3");
        Message msg4 = makeMessage(4L, chatRoom, user, "내 메시지");

        // alice의 lastReadMessage를 msg2로 설정
        ChatRoomMember aliceMember = chatRoom.getMembers().stream()
                .filter(m -> m.getUser().getId().equals(1L) && m.isActive())
                .findFirst()
                .orElseThrow(() -> new AssertionError("alice 멤버를 찾을 수 없습니다"));
        aliceMember.updateLastReadMessage(msg2);

        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.findByChatRoomIdOrderBySentAtAsc(10L))
                .thenReturn(List.of(msg1, msg2, msg3, msg4));

        long result = readStatusApplicationService.getUnreadCount(1L, 10L);

        // msg3만 카운트됨 (msg2 이후, sender != null && sender.id != 1 이고 msg4는 자신)
        assertEquals(1L, result);
    }

    // ─── getAllUnreadCounts ───────────────────────────────────────────────────

    @Test
    void getAllUnreadCounts_멤버인_채팅방만_포함() throws Exception {
        ChatRoom anotherRoom = new ChatRoom("다른방", null, otherUser);
        setId(anotherRoom, 20L);

        when(chatRoomRepository.findAllActive()).thenReturn(List.of(chatRoom, anotherRoom));
        // getUnreadCount(1L, 10L) 내부에서 chatRoomRepository.findById 호출
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.findByChatRoomIdOrderBySentAtAsc(10L)).thenReturn(List.of());

        Map<Long, Long> result = readStatusApplicationService.getAllUnreadCounts(1L);

        // alice는 chatRoom(10L)의 멤버이고 anotherRoom(20L)의 멤버가 아님
        assertTrue(result.containsKey(10L));
        assertFalse(result.containsKey(20L));
    }

    @Test
    void getAllUnreadCounts_활성_채팅방_없으면_빈_맵() {
        when(chatRoomRepository.findAllActive()).thenReturn(List.of());

        Map<Long, Long> result = readStatusApplicationService.getAllUnreadCounts(1L);

        assertTrue(result.isEmpty());
    }

    // ─── getUnreadCountsForActiveChatRooms ────────────────────────────────────

    @Test
    void getUnreadCountsForActiveChatRooms_멤버인_채팅방_목록_반환() throws Exception {
        ChatRoom anotherRoom = new ChatRoom("다른방", null, otherUser);
        setId(anotherRoom, 20L);

        when(chatRoomRepository.findAllActive()).thenReturn(List.of(chatRoom, anotherRoom));
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.findByChatRoomIdOrderBySentAtAsc(10L)).thenReturn(List.of());

        List<UnreadCountResponse> result =
                readStatusApplicationService.getUnreadCountsForActiveChatRooms(1L);

        // alice가 멤버인 chatRoom(10L)만 포함
        assertEquals(1, result.size());
        assertEquals(10L, result.get(0).getChatRoomId());
    }

    @Test
    void getUnreadCountsForActiveChatRooms_활성_채팅방_없으면_빈_목록() {
        when(chatRoomRepository.findAllActive()).thenReturn(List.of());

        List<UnreadCountResponse> result =
                readStatusApplicationService.getUnreadCountsForActiveChatRooms(1L);

        assertTrue(result.isEmpty());
    }
}
