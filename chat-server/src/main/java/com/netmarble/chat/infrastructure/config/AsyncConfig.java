package com.netmarble.chat.infrastructure.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * @Async 활성화 — MongoDB 비동기 쓰기 지원.
 * MongoDB 저장 실패가 STOMP 브로드캐스트를 차단하지 않도록 한다.
 */
@Configuration
@EnableAsync
public class AsyncConfig {
}
