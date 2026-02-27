package com.netmarble.chat.domain.model;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MessageTest {

    private ChatRoom chatRoom;
    private User sender;

    @BeforeEach
    void setUp() {
        sender = new User("alice");
        chatRoom = new ChatRoom("테스트방", null, sender);
    }

    @Test
    void 텍스트_메시지_생성_성공() {
        Message message = new Message(chatRoom, sender, "안녕하세요");

        assertEquals("안녕하세요", message.getContent());
        assertEquals(Message.MessageType.TEXT, message.getType());
        assertFalse(message.isDeleted());
        assertNotNull(message.getSentAt());
        assertEquals(sender, message.getSender());
        assertEquals(chatRoom, message.getChatRoom());
    }

    @Test
    void 메시지_내용_null이면_예외() {
        assertThrows(IllegalArgumentException.class,
                () -> new Message(chatRoom, sender, null));
    }

    @Test
    void 메시지_내용_공백이면_예외() {
        assertThrows(IllegalArgumentException.class,
                () -> new Message(chatRoom, sender, "  "));
    }

    @Test
    void 텍스트_메시지_5000자_초과시_예외() {
        String longContent = "a".repeat(5001);
        assertThrows(IllegalArgumentException.class,
                () -> new Message(chatRoom, sender, longContent, Message.MessageType.TEXT));
    }

    @Test
    void 텍스트_메시지_5000자_경계값_성공() {
        String content = "a".repeat(5000);
        Message message = new Message(chatRoom, sender, content, Message.MessageType.TEXT);
        assertEquals(5000, message.getContent().length());
    }

    @Test
    void 이미지_메시지_내용_길이제한_없음() {
        String longContent = "a".repeat(10000);
        Message message = new Message(chatRoom, sender, longContent, Message.MessageType.IMAGE);
        assertEquals(Message.MessageType.IMAGE, message.getType());
    }

    @Test
    void 메시지_소프트_삭제() {
        Message message = new Message(chatRoom, sender, "삭제될 메시지");
        assertFalse(message.isDeleted());

        message.delete();

        assertTrue(message.isDeleted());
    }

    @Test
    void 시스템_메시지_생성_발신자_없음() {
        Message systemMessage = Message.createSystemMessage(chatRoom, "홍길동님이 입장했습니다.");

        assertEquals("홍길동님이 입장했습니다.", systemMessage.getContent());
        assertEquals(Message.MessageType.SYSTEM, systemMessage.getType());
        assertNull(systemMessage.getSender());
        assertFalse(systemMessage.isDeleted());
        assertNotNull(systemMessage.getSentAt());
    }

    @Test
    void 메시지_타입_명시적_지정() {
        Message message = new Message(chatRoom, sender, "[스티커]", Message.MessageType.STICKER);
        assertEquals(Message.MessageType.STICKER, message.getType());
    }
}
