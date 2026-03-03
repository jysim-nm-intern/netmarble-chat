package com.netmarble.chat.infrastructure.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * JPA 쿼리 수 모니터링 인터셉터
 *
 * 단일 HTTP 요청에서 JPA 쿼리 5회 초과 시 WARN 로그 출력.
 * Hibernate Statistics 기반 — N+1 자동 감지용.
 */
@Slf4j
@Component
public class QueryMonitoringInterceptor implements HandlerInterceptor {

    private static final int QUERY_COUNT_THRESHOLD = 5;
    private static final ThreadLocal<Long> queryCountBefore = new ThreadLocal<>();

    @Autowired(required = false)
    private SessionFactory sessionFactory;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (sessionFactory != null) {
            Statistics stats = sessionFactory.getStatistics();
            queryCountBefore.set(stats.getQueryExecutionCount() + stats.getPrepareStatementCount());
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                 Object handler, Exception ex) {
        if (sessionFactory == null) {
            return;
        }

        Long before = queryCountBefore.get();
        if (before == null) {
            return;
        }

        Statistics stats = sessionFactory.getStatistics();
        long after = stats.getQueryExecutionCount() + stats.getPrepareStatementCount();
        long queryCount = after - before;

        if (queryCount > QUERY_COUNT_THRESHOLD) {
            log.warn("[N+1 감지] {} {} — JPA 쿼리 {}회 실행 (임계값: {}회)",
                request.getMethod(), request.getRequestURI(), queryCount, QUERY_COUNT_THRESHOLD);
        }

        queryCountBefore.remove();
    }
}
