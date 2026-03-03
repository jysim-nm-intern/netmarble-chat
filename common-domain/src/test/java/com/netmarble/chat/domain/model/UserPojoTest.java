package com.netmarble.chat.domain.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * User POJO 도메인 단위 테스트
 */
class UserPojoTest {

    @Test
    void 유효한_닉네임으로_사용자_생성_성공() {
        User user = new User("alice");
        assertEquals("alice", user.getNickname());
        assertTrue(user.isActive());
        assertNotNull(user.getCreatedAt());
        assertNotNull(user.getLastActiveAt());
    }

    @Test
    void 닉네임_null이면_예외() {
        assertThrows(IllegalArgumentException.class, () -> new User(null));
    }

    @Test
    void 닉네임_공백이면_예외() {
        assertThrows(IllegalArgumentException.class, () -> new User("   "));
    }

    @Test
    void 닉네임_1자이면_예외() {
        assertThrows(IllegalArgumentException.class, () -> new User("a"));
    }

    @Test
    void 닉네임_51자이면_예외() {
        assertThrows(IllegalArgumentException.class, () -> new User("a".repeat(51)));
    }

    @Test
    void 닉네임_2자_최소_성공() {
        User user = new User("ab");
        assertEquals("ab", user.getNickname());
    }

    @Test
    void 닉네임_50자_최대_성공() {
        String nick = "a".repeat(50);
        User user = new User(nick);
        assertEquals(nick, user.getNickname());
    }

    @Test
    void 한글_닉네임_생성_성공() {
        User user = new User("홍길동");
        assertEquals("홍길동", user.getNickname());
    }

    @Test
    void 닉네임에_특수문자포함시_예외() {
        assertThrows(IllegalArgumentException.class, () -> new User("alice!"));
    }

    @Test
    void 닉네임에_공백포함시_예외() {
        assertThrows(IllegalArgumentException.class, () -> new User("alice bob"));
    }

    @Test
    void 프로필색상_null이면_기본색상_사용() {
        User user = new User("alice", null);
        assertEquals("#4f85c8", user.getProfileColor());
    }

    @Test
    void 프로필색상_빈문자열이면_기본색상_사용() {
        User user = new User("alice", "");
        assertEquals("#4f85c8", user.getProfileColor());
    }

    @Test
    void 프로필색상_지정하면_해당_색상_사용() {
        User user = new User("alice", "#ff0000");
        assertEquals("#ff0000", user.getProfileColor());
    }

    @Test
    void updateProfileColor_유효한_색상으로_업데이트() {
        User user = new User("alice", "#000000");
        user.updateProfileColor("#ffffff");
        assertEquals("#ffffff", user.getProfileColor());
    }

    @Test
    void updateProfileColor_null이면_기존색상_유지() {
        User user = new User("alice", "#000000");
        user.updateProfileColor(null);
        assertEquals("#000000", user.getProfileColor());
    }

    @Test
    void updateProfileColor_빈문자열이면_기존색상_유지() {
        User user = new User("alice", "#000000");
        user.updateProfileColor("");
        assertEquals("#000000", user.getProfileColor());
    }

    @Test
    void updateProfileImage_이미지_설정() {
        User user = new User("alice");
        user.updateProfileImage("http://img.url");
        assertEquals("http://img.url", user.getProfileImage());
    }

    @Test
    void updateProfileImage_null로_이미지_제거() {
        User user = new User("alice");
        user.updateProfileImage("http://img.url");
        user.updateProfileImage(null);
        assertNull(user.getProfileImage());
    }

    @Test
    void updateLastActive_활동시간_갱신() throws InterruptedException {
        User user = new User("alice");
        var before = user.getLastActiveAt();
        Thread.sleep(1);
        user.updateLastActive();
        assertTrue(user.getLastActiveAt().isAfter(before));
    }

    @Test
    void deactivate_사용자_비활성화() {
        User user = new User("alice");
        user.deactivate();
        assertFalse(user.isActive());
    }

    @Test
    void activate_비활성_사용자_활성화() {
        User user = new User("alice");
        user.deactivate();
        user.activate();
        assertTrue(user.isActive());
    }
}
