package com.netmarble.chat.domain.model;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.*;

class ChatRoomMemberTest {

    private User user;
    private ChatRoom chatRoom;
    private ChatRoomMember member;

    @BeforeEach
    void setUp() throws Exception {
        user = new User("alice");
        setId(user, 1L);
        chatRoom = new ChatRoom("테스트방", null, user);
        setId(chatRoom, 10L);
        member = chatRoom.getMembers().get(0);
    }

    private void setId(Object obj, Long id) throws Exception {
        Field field = obj.getClass().getDeclaredField("id");
        field.setAccessible(true);
        field.set(obj, id);
    }

    private Message createMessage(Long id, String content) throws Exception {
        Message message = new Message(chatRoom, user, content);
        setId(message, id);
        return message;
    }

    @Test
    void 생성시_활성상태_온라인_기본값() {
        assertTrue(member.isActive());
        assertTrue(member.isOnline());
        assertNotNull(member.getJoinedAt());
        assertNotNull(member.getLastActiveAt());
        assertNull(member.getLastReadMessage());
    }

    @Test
    void leave_퇴장_성공() {
        member.leave();
        assertFalse(member.isActive());
        assertNotNull(member.getLeftAt());
    }

    @Test
    void leave_이미_퇴장한_경우_예외() {
        member.leave();
        assertThrows(IllegalStateException.class, () -> member.leave());
    }

    @Test
    void rejoin_재입장_성공() {
        member.leave();
        member.rejoin();
        assertTrue(member.isActive());
        assertTrue(member.isOnline());
        assertNull(member.getLeftAt());
    }

    @Test
    void rejoin_이미_활성_상태에서_예외() {
        assertThrows(IllegalStateException.class, () -> member.rejoin());
    }

    @Test
    void updateActiveStatus_온라인으로_전환() {
        member.updateActiveStatus(false);
        member.updateActiveStatus(true);
        assertTrue(member.isOnline());
    }

    @Test
    void updateActiveStatus_오프라인으로_전환() {
        member.updateActiveStatus(false);
        assertFalse(member.isOnline());
    }

    @Test
    void updateActivity_활동시간_갱신_및_온라인으로() {
        member.updateActiveStatus(false);
        member.updateActivity();
        assertTrue(member.isOnline());
    }

    @Test
    void updateLastReadMessage_null이면_아무것도_안함() {
        member.updateLastReadMessage(null);
        assertNull(member.getLastReadMessage());
    }

    @Test
    void updateLastReadMessage_최신_메시지로_업데이트() throws Exception {
        Message message = createMessage(1L, "첫 번째 메시지");
        member.updateLastReadMessage(message);
        assertEquals(message, member.getLastReadMessage());
    }

    @Test
    void updateLastReadMessage_오래된_메시지는_업데이트_안함() throws Exception {
        Message newer = createMessage(2L, "최신 메시지");
        Message older = createMessage(1L, "오래된 메시지");

        // 먼저 최신 메시지로 업데이트
        member.updateLastReadMessage(newer);
        // 오래된 메시지로 업데이트 시도 (무시되어야 함)
        member.updateLastReadMessage(older);

        assertEquals(newer, member.getLastReadMessage());
    }

    @Test
    void updateLastReadMessage_다른_채팅방_메시지이면_예외() throws Exception {
        User otherUser = new User("bob");
        setId(otherUser, 2L);
        ChatRoom otherRoom = new ChatRoom("다른방", null, otherUser);
        setId(otherRoom, 20L);
        Message otherRoomMessage = new Message(otherRoom, otherUser, "다른 방 메시지");
        setId(otherRoomMessage, 99L);

        assertThrows(IllegalArgumentException.class,
                () -> member.updateLastReadMessage(otherRoomMessage));
    }

    @Test
    void hasReadMessage_lastReadMessage_null이면_false() throws Exception {
        Message message = createMessage(1L, "메시지");
        assertFalse(member.hasReadMessage(message));
    }

    @Test
    void hasReadMessage_읽은_메시지이면_true() throws Exception {
        Message message = createMessage(5L, "읽은 메시지");
        member.updateLastReadMessage(message);

        assertTrue(member.hasReadMessage(message));
    }

    @Test
    void hasReadMessage_아직_읽지_않은_메시지이면_false() throws Exception {
        Message readMessage = createMessage(3L, "읽은 메시지");
        Message unreadMessage = createMessage(10L, "안읽은 메시지");
        member.updateLastReadMessage(readMessage);

        assertFalse(member.hasReadMessage(unreadMessage));
    }
}
