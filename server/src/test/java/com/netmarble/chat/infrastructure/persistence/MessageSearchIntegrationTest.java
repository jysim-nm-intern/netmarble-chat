package com.netmarble.chat.infrastructure.persistence;

import com.netmarble.chat.domain.model.ChatRoom;
import com.netmarble.chat.domain.model.Message;
import com.netmarble.chat.domain.model.User;
import com.netmarble.chat.domain.repository.ChatRoomRepository;
import com.netmarble.chat.domain.repository.MessageRepository;
import com.netmarble.chat.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 메시지 검색 기능 통합 테스트.
 *
 * 기본적으로 src/test/resources/application.properties 에 정의된 H2(in-memory) DB 설정을 사용합니다.
 * 실제 MySQL 환경에서 검증하려면 환경 변수 또는 별도 Spring Profile을 통해 데이터소스 설정을 오버라이드하세요.
 */
@Tag("integration")
@SpringBootTest
class MessageSearchIntegrationTest {

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private ChatRoomRepository chatRoomRepository;

    @Autowired
    private UserRepository userRepository;

    private ChatRoom chatRoom;
    private User user1;
    private User user2;

    @BeforeEach
    void setUp() {
        // 테스트 데이터 생성 (타임스탬프로 고유성 보장)
        long timestamp = System.currentTimeMillis();
        user1 = userRepository.save(new User("alice_" + timestamp));
        user2 = userRepository.save(new User("bob_" + timestamp));
        
        chatRoom = new ChatRoom("테스트 채팅방", "테스트 설명", user1);
        chatRoom = chatRoomRepository.save(chatRoom);
        
        chatRoom.addMember(user2);
        chatRoom = chatRoomRepository.save(chatRoom);
    }

    @Test
    void searchByChatRoomIdAndKeyword_WithMatches() {
        // 테스트 메시지 생성
        messageRepository.save(new Message(chatRoom, user1, "hello world"));
        messageRepository.save(new Message(chatRoom, user2, "goodbye"));
        messageRepository.save(new Message(chatRoom, user1, "hello everyone"));
        messageRepository.save(new Message(chatRoom, user2, "see you later"));
        messageRepository.save(new Message(chatRoom, user1, "hello again"));

        // 검색 수행
        List<Message> results = messageRepository.searchByChatRoomIdAndKeyword(chatRoom.getId(), "hello");

        // 검증
        assertEquals(3, results.size(), "검색 결과는 3개여야 합니다.");
        
        // 지번 확인 - 역순 정렬
        assertEquals("hello again", results.get(0).getContent());
        assertEquals("hello everyone", results.get(1).getContent());
        assertEquals("hello world", results.get(2).getContent());
    }

    @Test
    void searchByChatRoomIdAndKeyword_NoMatches() {
        // 테스트 메시지 생성
        messageRepository.save(new Message(chatRoom, user1, "apple"));
        messageRepository.save(new Message(chatRoom, user2, "banana"));
        messageRepository.save(new Message(chatRoom, user1, "cherry"));

        // 검색 수행
        List<Message> results = messageRepository.searchByChatRoomIdAndKeyword(chatRoom.getId(), "orange");

        // 검증
        assertTrue(results.isEmpty(), "검색 결과가 없어야 합니다.");
    }

    @Test
    void searchByChatRoomIdAndKeyword_CaseInsensitive() {
        // 테스트 메시지 생성
        messageRepository.save(new Message(chatRoom, user1, "Hello World"));
        messageRepository.save(new Message(chatRoom, user2, "goodbye"));

        // 소문자로 검색
        List<Message> results = messageRepository.searchByChatRoomIdAndKeyword(chatRoom.getId(), "hello");

        // 검증
        assertEquals(1, results.size(), "대소문자 구분 없이 검색되어야 합니다.");
        assertEquals("Hello World", results.get(0).getContent());
    }

    @Test
    void searchByChatRoomIdAndKeyword_WithSpecialCharacters() {
        // 특수문자를 포함한 메시지
        messageRepository.save(new Message(chatRoom, user1, "price: $100"));
        messageRepository.save(new Message(chatRoom, user2, "discount @20%"));
        messageRepository.save(new Message(chatRoom, user1, "email: test@example.com"));

        // 특수문자로 검색
        List<Message> results = messageRepository.searchByChatRoomIdAndKeyword(chatRoom.getId(), "$100");

        // 검증
        assertEquals(1, results.size());
        assertEquals("price: $100", results.get(0).getContent());
    }

    @Test
    void searchByChatRoomIdAndKeyword_OnlyActiveChatRoom() {
        // 두 개의 채팅방 생성
        ChatRoom chatRoom2 = new ChatRoom("다른 채팅방", "다른 설명", user1);
        chatRoom2 = chatRoomRepository.save(chatRoom2);

        // 각 채팅방에 메시지 저장
        messageRepository.save(new Message(chatRoom, user1, "hello world"));
        messageRepository.save(new Message(chatRoom2, user1, "hello universe"));

        // chatRoom에서 검색
        List<Message> results = messageRepository.searchByChatRoomIdAndKeyword(chatRoom.getId(), "hello");

        // 검증 - 해당 채팅방의 메시지만 검색됨
        assertEquals(1, results.size());
        assertEquals("hello world", results.get(0).getContent());
        assertEquals(chatRoom.getId(), results.get(0).getChatRoom().getId());
    }

    @Test
    void searchByChatRoomIdAndKeyword_IgnoresDeletedMessages() {
        // 테스트 메시지 생성
        Message msg1 = messageRepository.save(new Message(chatRoom, user1, "hello world"));
        Message msg2 = messageRepository.save(new Message(chatRoom, user2, "hello there"));
        Message msg3 = messageRepository.save(new Message(chatRoom, user1, "hello again"));

        // msg2 삭제
        msg2.delete();
        messageRepository.save(msg2);

        // 검색 수행
        List<Message> results = messageRepository.searchByChatRoomIdAndKeyword(chatRoom.getId(), "hello");

        // 검증 - 삭제된 메시지는 포함되지 않음
        assertEquals(2, results.size());
        assertTrue(results.stream().allMatch(m -> !m.isDeleted()));
    }
}
