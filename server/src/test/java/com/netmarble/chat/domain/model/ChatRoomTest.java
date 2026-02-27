package com.netmarble.chat.domain.model;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.*;

class ChatRoomTest {

    private User creator;
    private User otherUser;

    @BeforeEach
    void setUp() throws Exception {
        creator = new User("alice");
        setId(creator, 1L);
        otherUser = new User("bob");
        setId(otherUser, 2L);
    }

    private void setId(Object obj, Long id) throws Exception {
        Field field = obj.getClass().getDeclaredField("id");
        field.setAccessible(true);
        field.set(obj, id);
    }

    @Test
    void 채팅방_생성_성공_생성자_자동_멤버추가() {
        ChatRoom chatRoom = new ChatRoom("일반방", null, creator);

        assertEquals("일반방", chatRoom.getName());
        assertNull(chatRoom.getImageUrl());
        assertTrue(chatRoom.isActive());
        assertEquals(creator, chatRoom.getCreator());
        assertEquals(1, chatRoom.getActiveMemberCount());
        assertNotNull(chatRoom.getCreatedAt());
    }

    @Test
    void 채팅방_이름_null이면_예외() {
        assertThrows(IllegalArgumentException.class, () -> new ChatRoom(null, null, creator));
    }

    @Test
    void 채팅방_이름_공백이면_예외() {
        assertThrows(IllegalArgumentException.class, () -> new ChatRoom("   ", null, creator));
    }

    @Test
    void 채팅방_이름_1자이면_예외() {
        assertThrows(IllegalArgumentException.class, () -> new ChatRoom("가", null, creator));
    }

    @Test
    void 채팅방_이름_101자이면_예외() {
        assertThrows(IllegalArgumentException.class, () -> new ChatRoom("a".repeat(101), null, creator));
    }

    @Test
    void 채팅방_이름_2자_최소_성공() {
        ChatRoom chatRoom = new ChatRoom("AB", null, creator);
        assertEquals("AB", chatRoom.getName());
    }

    @Test
    void 채팅방_이름_100자_최대_성공() {
        String name = "a".repeat(100);
        ChatRoom chatRoom = new ChatRoom(name, null, creator);
        assertEquals(name, chatRoom.getName());
    }

    @Test
    void addMember_신규_멤버_추가_성공() {
        ChatRoom chatRoom = new ChatRoom("테스트방", null, creator);

        boolean result = chatRoom.addMember(otherUser);

        assertTrue(result);
        assertEquals(2, chatRoom.getActiveMemberCount());
    }

    @Test
    void addMember_이미_활성_멤버이면_false_반환() {
        ChatRoom chatRoom = new ChatRoom("테스트방", null, creator);

        boolean result = chatRoom.addMember(creator);

        assertFalse(result);
        assertEquals(1, chatRoom.getActiveMemberCount());
    }

    @Test
    void addMember_퇴장한_멤버_재입장_true_반환() {
        ChatRoom chatRoom = new ChatRoom("테스트방", null, creator);
        chatRoom.addMember(otherUser);
        chatRoom.removeMember(otherUser);
        assertEquals(1, chatRoom.getActiveMemberCount());

        boolean result = chatRoom.addMember(otherUser);

        assertTrue(result);
        assertEquals(2, chatRoom.getActiveMemberCount());
    }

    @Test
    void removeMember_멤버_퇴장_성공() {
        ChatRoom chatRoom = new ChatRoom("테스트방", null, creator);
        chatRoom.addMember(otherUser);

        chatRoom.removeMember(otherUser);

        assertEquals(1, chatRoom.getActiveMemberCount());
        assertFalse(chatRoom.isActiveMember(otherUser));
    }

    @Test
    void removeMember_미참여_사용자_퇴장시_예외() {
        ChatRoom chatRoom = new ChatRoom("테스트방", null, creator);

        assertThrows(IllegalArgumentException.class, () -> chatRoom.removeMember(otherUser));
    }

    @Test
    void isActiveMember_참여중인_사용자_true() {
        ChatRoom chatRoom = new ChatRoom("테스트방", null, creator);

        assertTrue(chatRoom.isActiveMember(creator));
    }

    @Test
    void isActiveMember_미참여_사용자_false() {
        ChatRoom chatRoom = new ChatRoom("테스트방", null, creator);

        assertFalse(chatRoom.isActiveMember(otherUser));
    }

    @Test
    void getActiveMemberCount_퇴장한_멤버_제외() {
        ChatRoom chatRoom = new ChatRoom("테스트방", null, creator);
        chatRoom.addMember(otherUser);
        chatRoom.removeMember(otherUser);

        assertEquals(1, chatRoom.getActiveMemberCount());
    }

    @Test
    void deactivate_채팅방_비활성화() {
        ChatRoom chatRoom = new ChatRoom("테스트방", null, creator);
        chatRoom.deactivate();
        assertFalse(chatRoom.isActive());
    }

    @Test
    void updateInfo_이름과_이미지_수정() {
        ChatRoom chatRoom = new ChatRoom("기존이름", null, creator);
        chatRoom.updateInfo("새이름", "http://image.url");
        assertEquals("새이름", chatRoom.getName());
        assertEquals("http://image.url", chatRoom.getImageUrl());
    }

    @Test
    void updateInfo_이름만_수정() {
        ChatRoom chatRoom = new ChatRoom("기존이름", "http://old.url", creator);
        chatRoom.updateInfo("새이름", null);
        assertEquals("새이름", chatRoom.getName());
        assertEquals("http://old.url", chatRoom.getImageUrl());
    }

    @Test
    void updateInfo_이름_유효하지_않으면_예외() {
        ChatRoom chatRoom = new ChatRoom("기존이름", null, creator);
        assertThrows(IllegalArgumentException.class, () -> chatRoom.updateInfo("가", null));
    }
}
