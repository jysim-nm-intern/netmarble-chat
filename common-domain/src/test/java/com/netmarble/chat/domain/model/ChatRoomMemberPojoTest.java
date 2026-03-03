package com.netmarble.chat.domain.model;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * ChatRoomMember POJO 도메인 단위 테스트
 * JPA 의존 없이 멤버 상태 전이 규칙을 검증한다.
 */
class ChatRoomMemberPojoTest {

    private ChatRoomMember member;

    @BeforeEach
    void setUp() {
        member = new ChatRoomMember(1L);
    }

    @Test
    void 생성시_활성상태_온라인_기본값() {
        assertTrue(member.isActive());
        assertTrue(member.isOnline());
        assertNotNull(member.getJoinedAt());
        assertNotNull(member.getLastActiveAt());
        assertNull(member.getLastReadMessageId());
        assertNull(member.getLeftAt());
    }

    @Test
    void 생성시_userId_null이면_예외() {
        assertThrows(IllegalArgumentException.class, () -> new ChatRoomMember(null));
    }

    @Test
    void leave_퇴장_성공() {
        member.leave();
        assertFalse(member.isActive());
        assertFalse(member.isOnline());
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
    void updateOnlineStatus_오프라인으로_전환() {
        member.updateOnlineStatus(false);
        assertFalse(member.isOnline());
        assertNotNull(member.getLastActiveAt());
    }

    @Test
    void updateOnlineStatus_온라인으로_전환() {
        member.updateOnlineStatus(false);
        member.updateOnlineStatus(true);
        assertTrue(member.isOnline());
    }

    @Test
    void updateLastReadMessage_messageId_저장() {
        member.updateLastReadMessage(42L);
        assertEquals(42L, member.getLastReadMessageId());
    }

    @Test
    void updateLastReadMessage_null로_초기화_가능() {
        member.updateLastReadMessage(42L);
        member.updateLastReadMessage(null);
        assertNull(member.getLastReadMessageId());
    }

    @Test
    void chatRoomId는_도메인_생성_시점에_null() {
        assertNull(member.getChatRoomId());
    }
}
