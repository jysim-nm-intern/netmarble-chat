package com.netmarble.chat.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Redis 설정 및 Lua Script 빈 등록
 */
@Configuration
@EnableScheduling
public class RedisConfig {

    /**
     * 읽음 상태 원자 처리 Lua Script
     *
     * KEYS[1]: read:{messageId}:users  (Set)
     * KEYS[2]: read:{messageId}:count  (String)
     * ARGV[1]: userId
     *
     * SADD가 1(신규)이면 카운트 증가, 0(중복)이면 현재 카운트 반환.
     */
    @Bean
    public RedisScript<Long> markAsReadScript() {
        DefaultRedisScript<Long> script = new DefaultRedisScript<>();
        script.setScriptText(
            "local added = redis.call('SADD', KEYS[1], ARGV[1]) " +
            "if added == 1 then " +
            "  return redis.call('INCR', KEYS[2]) " +
            "end " +
            "local count = redis.call('GET', KEYS[2]) " +
            "if count == false then return 0 end " +
            "return tonumber(count)"
        );
        script.setResultType(Long.class);
        return script;
    }

    /**
     * String 타입 RedisTemplate (읽음 상태, JWT 블랙리스트 등 공용)
     */
    @Bean
    public RedisTemplate<String, String> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, String> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new StringRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }
}
