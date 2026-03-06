## Why

Spring Boot(Java 17) 기반의 chat-server와 api-server를 NestJS(TypeScript)로 전면 마이그레이션한다. 두 가지 목적이 있다:

1. **SDD 품질 검증**: SDD 명세가 "기술 독립적"이라는 원칙을 실제로 검증한다. AI가 SDD 명세만 보고 다른 언어로 동일한 시스템을 구현할 수 있는지 테스트한다.
2. **성능/스케일링 개선**: Node.js 이벤트 루프는 "많은 동시 WebSocket 연결 + 가벼운 I/O 처리" 패턴인 채팅 서버에 최적화되어 있다. 메모리 사용량 감소, 동시 연결 수 증가, 콜드 스타트 단축이 기대된다.

부가 효과로 클라이언트(React/TypeScript)와 서버의 언어가 통일되어 풀스택 TypeScript 코드베이스가 된다.

## What Changes

- **기존 서버 보존**: `chat-server` → `server/chat-server-spring`, `api-server` → `server/api-server-spring`으로 리네이밍 (A/B 성능 비교용)
- **NestJS chat-server 신규 구현**: STOMP WebSocket + REST API + MySQL(TypeORM) + MongoDB(Mongoose) + Redis + RabbitMQ
- **NestJS api-server 신규 구현**: REST API + MongoDB(Mongoose) 읽기 전용
- **SDD 문서 전면 업데이트**: 기술 스택 변경에 따라 17개 문서/설정 파일 수정 (SDD First 접근)
- **Docker/CI 업데이트**: docker-compose.yml, GitHub Actions CI 파이프라인을 NestJS 빌드로 전환
- **클라이언트 변경 없음**: STOMP 프로토콜과 REST API 계약을 그대로 유지하여 클라이언트 코드 수정 불필요

## Capabilities

### New Capabilities
- `nestjs-chat-server`: NestJS 기반 chat-server 구현 — DDD 4계층 구조, STOMP WebSocket, REST API, MySQL(TypeORM) + MongoDB(Mongoose) + Redis 연동, RabbitMQ STOMP Broker Relay(scale 모드)
- `nestjs-api-server`: NestJS 기반 api-server 구현 — MongoDB 메시지 이력 조회, cursor-based 페이지네이션
- `sdd-migration-docs`: SDD 문서 및 프로젝트 설정 파일 NestJS 기준 전면 업데이트 — 17개 파일 수정
- `nestjs-docker-ci`: Docker 빌드 설정 및 GitHub Actions CI 파이프라인 NestJS 전환

### Modified Capabilities
- `multi-module-architecture`: 서버 모듈 구조가 Java 멀티 모듈(Gradle)에서 NestJS 모듈 시스템으로 변경
- `stomp-broker-relay`: Spring SimpleBroker/RabbitMQ Relay에서 Node.js STOMP 서버 + RabbitMQ로 구현 방식 변경
- `multi-instance-chat`: 다중 인스턴스 채팅 아키텍처의 런타임이 JVM에서 Node.js로 변경

## Impact

- **서버 코드**: chat-server, api-server 전체 재작성 (Java → TypeScript)
- **빌드 시스템**: Gradle → npm/pnpm + NestJS CLI
- **ORM**: JPA/Hibernate → TypeORM(MySQL) + Mongoose(MongoDB)
- **테스트 프레임워크**: JUnit 5 → Jest + @nestjs/testing
- **Docker**: JDK 기반 이미지 → Node.js 기반 이미지, 멀티스테이지 빌드 변경
- **CI/CD**: GitHub Actions에서 gradlew → npm 빌드로 전환
- **문서**: SDD 7개 문서 + 프로젝트 루트 4개 + .github 3개 + client rules 2개 = 총 17개 파일 수정
- **API 계약**: 변경 없음 (SDD 05-interface.md 계약 준수)
- **DB 스키마**: 변경 없음 (MySQL, MongoDB 스키마 유지)
- **클라이언트**: 변경 없음
