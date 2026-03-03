package com.netmarble.chat.infrastructure.persistence;

import com.netmarble.chat.domain.model.ChatRoom;
import com.netmarble.chat.domain.model.User;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.TestPropertySource;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * JPA N+1 쿼리 최적화 검증 테스트 (Task 5.6)
 *
 * Hibernate Statistics를 활용하여 JOIN FETCH 적용 전후 쿼리 수를 비교.
 * findAllActive() 호출 시 단일 쿼리(또는 2회 이하)로 처리되어야 함.
 */
@DataJpaTest
@Tag("integration")
@TestPropertySource(properties = {
    "spring.jpa.properties.hibernate.generate_statistics=true",
    "spring.jpa.properties.hibernate.show_sql=true"
})
class ChatRoomQueryOptimizationTest {

    @Autowired
    private JpaChatRoomRepository chatRoomRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private Statistics statistics;

    @BeforeEach
    void setUp() {
        SessionFactory sessionFactory = entityManagerFactory.unwrap(SessionFactory.class);
        statistics = sessionFactory.getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();

        // EntityManager.persist()로 ambiguous save 우회
        User creator1 = new User("생성자1", "#ff0000");
        entityManager.persist(creator1);
        User creator2 = new User("생성자2", "#00ff00");
        entityManager.persist(creator2);
        User member1 = new User("멤버1", "#0000ff");
        entityManager.persist(member1);

        ChatRoom room1 = new ChatRoom("채팅방1", null, creator1);
        room1.addMember(member1);
        entityManager.persist(room1);

        ChatRoom room2 = new ChatRoom("채팅방2", null, creator2);
        room2.addMember(member1);
        entityManager.persist(room2);

        entityManager.flush();
        entityManager.clear();
        statistics.clear();
    }

    @Test
    @DisplayName("findAllActive() — JOIN FETCH로 N+1 없이 단일 쿼리 처리")
    void findAllActive_noNPlusOneQuery() {
        List<ChatRoom> rooms = chatRoomRepository.findAllActive();

        long queryCount = statistics.getPrepareStatementCount();

        assertThat(rooms).isNotEmpty();
        // JOIN FETCH 적용 시 N+1 없이 1~2쿼리 이내로 처리되어야 함
        assertThat(queryCount)
            .as("N+1 없이 단일 JOIN FETCH 쿼리로 처리되어야 함 (실제 쿼리 수: %d)", queryCount)
            .isLessThanOrEqualTo(2L);
    }

    @Test
    @DisplayName("findAllActive() — 결과에서 members 접근 시 추가 쿼리 없음")
    void findAllActive_accessingMembers_noAdditionalQuery() {
        List<ChatRoom> rooms = chatRoomRepository.findAllActive();
        statistics.clear();

        // 이미 JOIN FETCH로 로드된 members에 접근
        rooms.forEach(room -> {
            long count = room.getActiveMemberCount();
            assertThat(count).isGreaterThanOrEqualTo(1);
        });

        long queriesAfterAccess = statistics.getPrepareStatementCount();
        assertThat(queriesAfterAccess)
            .as("members는 이미 FETCH 로드되었으므로 추가 쿼리 없어야 함")
            .isEqualTo(0L);
    }
}
