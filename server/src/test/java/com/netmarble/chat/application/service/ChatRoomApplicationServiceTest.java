package com.netmarble.chat.application.service;

import com.netmarble.chat.application.dto.*;
import com.netmarble.chat.domain.model.ChatRoom;
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
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatRoomApplicationServiceTest {

    @Mock
    private ChatRoomRepository chatRoomRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private MessageRepository messageRepository;
    @Mock
    private ChatRoomMemberRepository chatRoomMemberRepository;
    @Mock
    private ReadStatusApplicationService readStatusApplicationService;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private ChatRoomApplicationService chatRoomApplicationService;

    private User creator;
    private User otherUser;
    private ChatRoom chatRoom;

    @BeforeEach
    void setUp() throws Exception {
        creator = new User("alice");
        setId(creator, 1L);
        otherUser = new User("bob");
        setId(otherUser, 2L);
        chatRoom = new ChatRoom("테스트방", null, creator);
        setId(chatRoom, 10L);
    }

    private void setId(Object obj, Long id) throws Exception {
        Field field = obj.getClass().getDeclaredField("id");
        field.setAccessible(true);
        field.set(obj, id);
    }

    private Message makeSystemMessage(Long id, ChatRoom room, String content) throws Exception {
        Message msg = Message.createSystemMessage(room, content);
        setId(msg, id);
        return msg;
    }

    // ─── createChatRoom ───────────────────────────────────────────────────────

    @Test
    void createChatRoom_성공() throws Exception {
        CreateChatRoomRequest request = new CreateChatRoomRequest("새방", 1L, null);
        Message systemMsg = makeSystemMessage(100L, chatRoom, "alice님이 채팅방을 생성했습니다.");

        when(userRepository.findById(1L)).thenReturn(Optional.of(creator));
        when(chatRoomRepository.save(any(ChatRoom.class))).thenReturn(chatRoom);
        when(messageRepository.save(any(Message.class))).thenReturn(systemMsg);

        ChatRoomResponse response = chatRoomApplicationService.createChatRoom(request);

        assertNotNull(response);
        assertEquals(10L, response.getId());
        verify(chatRoomRepository).save(any(ChatRoom.class));
        verify(messageRepository).save(any(Message.class));
    }

    @Test
    void createChatRoom_존재하지_않는_사용자_예외() {
        CreateChatRoomRequest request = new CreateChatRoomRequest("새방", 999L, null);
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> chatRoomApplicationService.createChatRoom(request));
    }

    // ─── getChatRoomById ──────────────────────────────────────────────────────

    @Test
    void getChatRoomById_성공() {
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));

        ChatRoomResponse response = chatRoomApplicationService.getChatRoomById(10L);

        assertEquals(10L, response.getId());
    }

    @Test
    void getChatRoomById_존재하지_않으면_예외() {
        when(chatRoomRepository.findById(999L)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> chatRoomApplicationService.getChatRoomById(999L));
        assertTrue(ex.getMessage().contains("999"));
    }

    // ─── getAllActiveChatRooms ────────────────────────────────────────────────

    @Test
    void getAllActiveChatRooms_userId_없으면_isMember_false() {
        when(chatRoomRepository.findAllActive()).thenReturn(List.of(chatRoom));

        List<ChatRoomResponse> result = chatRoomApplicationService.getAllActiveChatRooms(null);

        assertEquals(1, result.size());
        assertFalse(Boolean.TRUE.equals(result.get(0).getIsMember()));
    }

    @Test
    void getAllActiveChatRooms_멤버인_방은_isMember_true() {
        when(chatRoomRepository.findAllActive()).thenReturn(List.of(chatRoom));
        when(chatRoomMemberRepository.findActiveChatRoomIdsByUserId(1L)).thenReturn(Set.of(10L));
        when(messageRepository.findLastByChatRoomId(10L)).thenReturn(Optional.empty());
        when(readStatusApplicationService.getUnreadCount(1L, 10L)).thenReturn(0L);

        List<ChatRoomResponse> result = chatRoomApplicationService.getAllActiveChatRooms(1L);

        assertEquals(1, result.size());
        assertTrue(Boolean.TRUE.equals(result.get(0).getIsMember()));
    }

    @Test
    void getAllActiveChatRooms_활성_방_없으면_빈_목록() {
        when(chatRoomRepository.findAllActive()).thenReturn(List.of());

        List<ChatRoomResponse> result = chatRoomApplicationService.getAllActiveChatRooms(null);

        assertTrue(result.isEmpty());
    }

    // ─── joinChatRoom ─────────────────────────────────────────────────────────

    @Test
    void joinChatRoom_신규_입장() throws Exception {
        JoinChatRoomRequest request = new JoinChatRoomRequest(10L, 2L);
        Message systemMsg = makeSystemMessage(101L, chatRoom, "bob님이 입장했습니다.");

        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(userRepository.findById(2L)).thenReturn(Optional.of(otherUser));
        when(messageRepository.save(any(Message.class))).thenReturn(systemMsg);
        when(messageRepository.findLastByChatRoomId(10L)).thenReturn(Optional.of(systemMsg));
        when(chatRoomRepository.save(any(ChatRoom.class))).thenReturn(chatRoom);

        ChatRoomResponse response = chatRoomApplicationService.joinChatRoom(request);

        assertNotNull(response);
        verify(messageRepository).save(any(Message.class));
        verify(messagingTemplate).convertAndSend(eq("/topic/chatroom/10"), any(MessageResponse.class));
    }

    @Test
    void joinChatRoom_이미_활성_멤버이면_시스템메시지_없음() throws Exception {
        JoinChatRoomRequest request = new JoinChatRoomRequest(10L, 1L);
        Message lastMsg = makeSystemMessage(50L, chatRoom, "alice님이 채팅방을 생성했습니다.");

        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(userRepository.findById(1L)).thenReturn(Optional.of(creator));
        when(messageRepository.findLastByChatRoomId(10L)).thenReturn(Optional.of(lastMsg));
        when(chatRoomRepository.save(any(ChatRoom.class))).thenReturn(chatRoom);

        chatRoomApplicationService.joinChatRoom(request);

        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }

    @Test
    void joinChatRoom_채팅방_없으면_예외() {
        JoinChatRoomRequest request = new JoinChatRoomRequest(999L, 1L);
        when(chatRoomRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> chatRoomApplicationService.joinChatRoom(request));
    }

    @Test
    void joinChatRoom_사용자_없으면_예외() {
        JoinChatRoomRequest request = new JoinChatRoomRequest(10L, 999L);
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> chatRoomApplicationService.joinChatRoom(request));
    }

    // ─── leaveChatRoom ───────────────────────────────────────────────────────

    @Test
    void leaveChatRoom_성공() throws Exception {
        chatRoom.addMember(otherUser);
        Message systemMsg = makeSystemMessage(102L, chatRoom, "bob님이 퇴장했습니다.");

        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(userRepository.findById(2L)).thenReturn(Optional.of(otherUser));
        when(chatRoomRepository.save(any(ChatRoom.class))).thenReturn(chatRoom);
        when(messageRepository.save(any(Message.class))).thenReturn(systemMsg);

        assertDoesNotThrow(() -> chatRoomApplicationService.leaveChatRoom(10L, 2L));

        verify(messagingTemplate).convertAndSend(eq("/topic/chatroom/10"), any(MessageResponse.class));
    }

    @Test
    void leaveChatRoom_채팅방_없으면_예외() {
        when(chatRoomRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> chatRoomApplicationService.leaveChatRoom(999L, 1L));
    }

    @Test
    void leaveChatRoom_사용자_없으면_예외() {
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> chatRoomApplicationService.leaveChatRoom(10L, 999L));
    }

    // ─── getActiveChatRoomMembers ────────────────────────────────────────────

    @Test
    void getActiveChatRoomMembers_활성_멤버_반환() {
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));

        List<ChatRoomMemberResponse> result =
                chatRoomApplicationService.getActiveChatRoomMembers(10L);

        assertEquals(1, result.size());
    }

    @Test
    void getActiveChatRoomMembers_채팅방_없으면_예외() {
        when(chatRoomRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> chatRoomApplicationService.getActiveChatRoomMembers(999L));
    }

    // ─── updateMemberActiveStatus ────────────────────────────────────────────

    @Test
    void updateMemberActiveStatus_온라인으로_전환() throws Exception {
        Message lastMsg = makeSystemMessage(50L, chatRoom, "시스템");

        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.findLastByChatRoomId(10L)).thenReturn(Optional.of(lastMsg));
        when(chatRoomRepository.save(any(ChatRoom.class))).thenReturn(chatRoom);

        assertDoesNotThrow(() ->
                chatRoomApplicationService.updateMemberActiveStatus(10L, 1L, true));
    }

    @Test
    void updateMemberActiveStatus_오프라인으로_전환() {
        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(chatRoomRepository.save(any(ChatRoom.class))).thenReturn(chatRoom);

        assertDoesNotThrow(() ->
                chatRoomApplicationService.updateMemberActiveStatus(10L, 1L, false));
    }

    @Test
    void updateMemberActiveStatus_채팅방_없으면_예외() {
        when(chatRoomRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> chatRoomApplicationService.updateMemberActiveStatus(999L, 1L, true));
    }

    // ─── updateMemberActivity ────────────────────────────────────────────────

    @Test
    void updateMemberActivity_성공() throws Exception {
        Message lastMsg = makeSystemMessage(50L, chatRoom, "시스템");

        when(chatRoomRepository.findById(10L)).thenReturn(Optional.of(chatRoom));
        when(messageRepository.findLastByChatRoomId(10L)).thenReturn(Optional.of(lastMsg));
        when(chatRoomRepository.save(any(ChatRoom.class))).thenReturn(chatRoom);

        assertDoesNotThrow(() -> chatRoomApplicationService.updateMemberActivity(10L, 1L));
    }

    @Test
    void updateMemberActivity_채팅방_없으면_예외() {
        when(chatRoomRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> chatRoomApplicationService.updateMemberActivity(999L, 1L));
    }
}
