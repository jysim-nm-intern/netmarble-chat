package com.netmarble.chat.domain.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Message POJO 도메인 단위 테스트
 * ID 기반 참조(chatRoomId, senderId)를 사용하는 POJO 계약을 검증한다.
 */
class MessagePojoTest {

    @Test
    void 텍스트_메시지_생성_성공() {
        Message msg = new Message(1L, 10L, "alice", "안녕하세요");

        assertEquals("안녕하세요", msg.getContent());
        assertEquals(Message.MessageType.TEXT, msg.getType());
        assertEquals(1L, msg.getChatRoomId());
        assertEquals(10L, msg.getSenderId());
        assertEquals("alice", msg.getSenderNickname());
        assertFalse(msg.isDeleted());
        assertNotNull(msg.getSentAt());
    }

    @Test
    void 메시지_내용_null이면_예외() {
        assertThrows(IllegalArgumentException.class,
                () -> new Message(1L, 10L, "alice", null));
    }

    @Test
    void 메시지_내용_공백이면_예외() {
        assertThrows(IllegalArgumentException.class,
                () -> new Message(1L, 10L, "alice", "  "));
    }

    @Test
    void 텍스트_메시지_5000자_초과시_예외() {
        assertThrows(IllegalArgumentException.class,
                () -> new Message(1L, 10L, "alice", "a".repeat(5001), Message.MessageType.TEXT));
    }

    @Test
    void 텍스트_메시지_5000자_경계값_성공() {
        Message msg = new Message(1L, 10L, "alice", "a".repeat(5000), Message.MessageType.TEXT);
        assertEquals(5000, msg.getContent().length());
    }

    @Test
    void 이미지_메시지_내용_길이제한_없음() {
        Message msg = new Message(1L, 10L, "alice", "a".repeat(10000), Message.MessageType.IMAGE);
        assertEquals(Message.MessageType.IMAGE, msg.getType());
    }

    @Test
    void 메시지_소프트_삭제() {
        Message msg = new Message(1L, 10L, "alice", "삭제될 메시지");
        assertFalse(msg.isDeleted());

        msg.delete();

        assertTrue(msg.isDeleted());
    }

    @Test
    void 시스템_메시지_생성_senderId_null() {
        Message sysMsg = Message.createSystemMessage(1L, "홍길동님이 입장했습니다.");

        assertEquals("홍길동님이 입장했습니다.", sysMsg.getContent());
        assertEquals(Message.MessageType.SYSTEM, sysMsg.getType());
        assertNull(sysMsg.getSenderId());
        assertNull(sysMsg.getSenderNickname());
        assertFalse(sysMsg.isDeleted());
        assertNotNull(sysMsg.getSentAt());
    }

    @Test
    void 메시지_타입_명시적_지정() {
        Message msg = new Message(1L, 10L, "alice", "[스티커]", Message.MessageType.STICKER);
        assertEquals(Message.MessageType.STICKER, msg.getType());
    }
}
