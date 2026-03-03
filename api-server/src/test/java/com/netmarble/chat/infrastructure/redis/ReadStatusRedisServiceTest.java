package com.netmarble.chat.infrastructure.redis;

import com.netmarble.chat.infrastructure.mongo.repository.MessageMongoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Redis 읽음 상태 서비스 단위 테스트 (Task 6.6, 6.7)
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReadStatusRedisServiceTest {

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @Mock
    private RedisScript<Long> markAsReadScript;

    @Mock
    private MessageMongoRepository messageMongoRepository;

    @Mock
    private ValueOperations<String, String> valueOps;

    private ReadStatusRedisService readStatusRedisService;

    @BeforeEach
    void setUp() {
        given(redisTemplate.opsForValue()).willReturn(valueOps);
        readStatusRedisService = new ReadStatusRedisService(
            redisTemplate, markAsReadScript, messageMongoRepository);
    }

    @Test
    @DisplayName("신규 읽음 처리 시 true 반환 (카운트 증가)")
    void markAsRead_newRead_returnsTrue() {
        given(redisTemplate.execute(any(RedisScript.class), anyList(), anyString()))
            .willReturn(1L);

        boolean result = readStatusRedisService.markAsRead("msg-1", "user-1");

        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("중복 읽음 시 false 반환 (카운트 미증가) — Task 6.7")
    void markAsRead_duplicateRead_returnsFalse() {
        // Lua Script가 0 반환 → 이미 읽은 유저
        given(redisTemplate.execute(any(RedisScript.class), anyList(), anyString()))
            .willReturn(0L);

        boolean firstResult = readStatusRedisService.markAsRead("msg-1", "user-1");
        boolean secondResult = readStatusRedisService.markAsRead("msg-1", "user-1");

        // 첫 번째: 0L이면 false
        assertThat(firstResult).isFalse();
        assertThat(secondResult).isFalse();
    }

    @Test
    @DisplayName("동시 100명 읽음 — Lua Script가 100회 호출됨 (Task 6.6)")
    void markAsRead_concurrent100Users_scriptCalledHundredTimes() throws InterruptedException {
        int userCount = 100;
        AtomicInteger callCount = new AtomicInteger(0);

        given(redisTemplate.execute(any(RedisScript.class), anyList(), anyString()))
            .willAnswer(invocation -> {
                callCount.incrementAndGet();
                return (long) callCount.get();
            });

        CountDownLatch latch = new CountDownLatch(userCount);
        ExecutorService executor = Executors.newFixedThreadPool(20);

        for (int i = 0; i < userCount; i++) {
            final String userId = "user-" + i;
            executor.submit(() -> {
                try {
                    readStatusRedisService.markAsRead("msg-concurrent", userId);
                } finally {
                    latch.countDown();
                }
            });
        }

        latch.await();
        executor.shutdown();

        // Lua Script가 정확히 100번 호출되어야 함
        verify(redisTemplate, times(userCount)).execute(any(RedisScript.class), anyList(), anyString());
        assertThat(callCount.get()).isEqualTo(userCount);
    }

    @Test
    @DisplayName("Redis 장애 시 MongoDB fallback으로 대체 처리")
    void markAsRead_redisFailure_mongoFallback() {
        given(redisTemplate.execute(any(RedisScript.class), anyList(), anyString()))
            .willThrow(new RuntimeException("Redis 연결 실패"));
        given(messageMongoRepository.findById(anyString()))
            .willReturn(java.util.Optional.empty());

        boolean result = readStatusRedisService.markAsRead("msg-fail", "user-1");

        // MongoDB에도 메시지가 없으므로 false, 하지만 예외는 발생하지 않아야 함
        assertThat(result).isFalse();
    }
}
