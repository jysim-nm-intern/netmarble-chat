## Why

현재 Phase 1에서 구현된 MySQL 기반 단일 서버 아키텍처는 채팅방 내 동시 접속 유저가 증가할수록 N+1 쿼리 문제, 읽음 상태 조회 병목, 스키마 경직성으로 인한 응답 지연이 발생하고 있으며, 1,000명 이상의 대규모 유저를 수용하기 위해 데이터 저장소 전환 및 멀티모듈 아키텍처로의 구조 개편이 필요하다.

## What Changes

- **BREAKING** MySQL 기반 메시지/읽음 상태 저장소를 MongoDB로 전환하여 비정규화 문서 모델로 재설계
- **BREAKING** 단일 Spring Boot 모듈을 `chat-server`, `api-server`, `common-domain` 3개의 Gradle 멀티모듈로 분리
- JPA N+1 문제를 해결하기 위한 Fetch Join 및 DTO Projection 적용
- 읽음 상태(Read Status) 체크 로직을 Redis 원자 연산으로 이관하여 동시성 보장
- MongoDB Cursor-based 페이징 도입으로 대용량 메시지 이력 조회 성능 개선
- Stateless 서버 원칙 적용: HTTP 세션 제거, JWT 기반 인증, Redis 세션 스토어 적용
- GitHub Issues #36~#41에 정의된 성능 목표(Throughput 개선, 1,000명 이상 수용) 달성

## Capabilities

### New Capabilities

- `mongodb-data-model`: Room-Message-ReadStatus 관계를 MongoDB 비정규화 문서 모델로 설계하고, 대용량 조회를 위한 인덱스 전략 및 Cursor-based 페이징 계약 정의
- `query-optimization`: JPA N+1 해소를 위한 Fetch Join/DTO 직접 조회 가이드라인과 Redis 기반 읽음 상태 원자성 보장 방안 명세
- `multi-module-architecture`: Gradle 멀티모듈 구조 정의, 모듈 간 의존성 방향 규칙, 공유 도메인 엔티티 관리 규칙
- `horizontal-scalability`: Stateless 서버 설계 원칙, JWT 인증 전환, Redis 세션/캐시 전략 정의

### Modified Capabilities

_(현재 openspec/specs/에 등록된 기존 명세 없음 — Phase 1은 SDD 문서 기반으로 관리됨)_

## Impact

- **데이터 저장소:** MySQL → MongoDB (메시지, 읽음 상태), Redis (세션, 읽음 상태 캐시) 추가
- **서버 모듈:** `server/` 단일 모듈 → `chat-server/`, `api-server/`, `common-domain/` 3개 모듈로 분리
- **API 계약:** 메시지 조회 API의 페이징 파라미터 변경 (`page` → `cursor` 방식)
- **인증 방식:** 세션 기반 → JWT + Redis 기반으로 변경 (클라이언트 토큰 처리 로직 변경 필요)
- **의존성 추가:** `spring-boot-starter-data-mongodb`, `spring-data-redis`, `jjwt`
- **관련 GitHub Issues:** #36 (성능 목표), #37 (쿼리 최적화), #38 (MongoDB 전환), #39 (멀티모듈), #40 (수평 확장), #41 (읽음 상태 이관)
