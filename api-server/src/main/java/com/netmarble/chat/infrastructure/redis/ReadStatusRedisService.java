package com.netmarble.chat.infrastructure.redis;

import com.netmarble.chat.infrastructure.mongo.document.MessageDocument;
import com.netmarble.chat.infrastructure.mongo.repository.MessageMongoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Redis 기반 읽음 상태 원자 처리 서비스
 *
 * 키 설계:
 *   read:{messageId}:users  → Redis Set (중복 방지)
 *   read:{messageId}:count  → Redis String (카운트)
 *
 * 원자성 보장: SADD + INCR을 Lua Script로 단일 트랜잭션 처리.
 * TTL: 7일 (메시지 읽음 데이터 보존 기간)
 *
 * MongoDB 동기화: 5초 간격 배치 스케줄러 (@Scheduled)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReadStatusRedisService {

    private static final String USER_KEY_PREFIX = "read:%s:users";
    private static final String COUNT_KEY_PREFIX = "read:%s:count";
    private static final long READ_STATUS_TTL_DAYS = 7;

    private final RedisTemplate<String, String> redisTemplate;
    private final RedisScript<Long> markAsReadScript;
    private final MessageMongoRepository messageMongoRepository;

    /**
     * 읽음 등록 — Lua Script로 원자적 처리 (중복 방지 + 카운트 증가)
     *
     * @return 실제 읽음 카운트 증가 여부 (true: 새로 읽음, false: 이미 읽음)
     */
    public boolean markAsRead(String messageId, String userId) {
        String userKey = String.format(USER_KEY_PREFIX, messageId);
        String countKey = String.format(COUNT_KEY_PREFIX, messageId);

        try {
            Long result = redisTemplate.execute(
                markAsReadScript,
                List.of(userKey, countKey),
                userId
            );

            if (result != null && result > 0) {
                // TTL 갱신 (7일)
                redisTemplate.expire(userKey, Duration.ofDays(READ_STATUS_TTL_DAYS));
                redisTemplate.expire(countKey, Duration.ofDays(READ_STATUS_TTL_DAYS));
                return true;
            }
            return false;

        } catch (Exception e) {
            log.warn("[ReadStatus] Redis 오류 발생, MongoDB fallback 처리: messageId={}, userId={}, error={}",
                messageId, userId, e.getMessage());
            return mongoFallbackMarkAsRead(messageId, userId);
        }
    }

    /**
     * 메시지 읽음 카운트 조회
     */
    public int getReadCount(String messageId) {
        String countKey = String.format(COUNT_KEY_PREFIX, messageId);
        try {
            String value = redisTemplate.opsForValue().get(countKey);
            return value != null ? Integer.parseInt(value) : 0;
        } catch (Exception e) {
            log.warn("[ReadStatus] Redis 카운트 조회 실패: messageId={}", messageId);
            return 0;
        }
    }

    /**
     * Redis 장애 시 MongoDB $inc fallback
     */
    private boolean mongoFallbackMarkAsRead(String messageId, String userId) {
        try {
            Optional<MessageDocument> docOpt = messageMongoRepository.findById(messageId);
            if (docOpt.isPresent()) {
                MessageDocument doc = docOpt.get();
                doc.incrementReadCount();
                messageMongoRepository.save(doc);
                return true;
            }
        } catch (Exception ex) {
            log.error("[ReadStatus] MongoDB fallback도 실패: messageId={}, error={}", messageId, ex.getMessage());
        }
        return false;
    }

    /**
     * Redis → MongoDB 읽음 카운트 동기화 배치 (5초 간격)
     */
    @Scheduled(fixedDelay = 5000)
    public void syncReadCountToMongo() {
        try {
            Set<String> countKeys = redisTemplate.keys("read:*:count");
            if (countKeys == null || countKeys.isEmpty()) {
                return;
            }

            for (String countKey : countKeys) {
                String messageId = countKey.replace("read:", "").replace(":count", "");
                String countStr = redisTemplate.opsForValue().get(countKey);
                if (countStr == null) continue;

                int count = Integer.parseInt(countStr);
                messageMongoRepository.findById(messageId).ifPresent(doc -> {
                    doc.syncReadCount(count);
                    messageMongoRepository.save(doc);
                });
            }

            log.debug("[ReadStatus] MongoDB 동기화 완료: {}개 메시지 카운트 반영", countKeys.size());
        } catch (Exception e) {
            log.error("[ReadStatus] 동기화 배치 오류: {}", e.getMessage());
        }
    }
}
