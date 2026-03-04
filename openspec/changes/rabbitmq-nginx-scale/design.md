## Context

현재 chat-server는 Spring의 **SimpleBroker**를 사용하여 STOMP 메시지를 라우팅한다. SimpleBroker는 JVM 내 메모리 기반으로 동작하므로:

- **단일 인스턴스에서만 동작** — 다중 인스턴스 간 메시지 동기화 불가
- **방당 200명 동시 접속 한계** — Phase 2 부하 테스트에서 확인
- **수평 확장 불가** — 인스턴스를 추가해도 브로커가 격리되어 메시지 전달 안 됨

현재 인프라: MySQL(관계형) + MongoDB(메시지) + Redis(읽음 상태), chat-server 1대(8080) + api-server 1대(8081), Nginx 없음.

## Goals / Non-Goals

**Goals:**
- SimpleBroker → RabbitMQ STOMP Relay로 전환하여 외부 브로커 기반 메시지 라우팅
- chat-server 2인스턴스 기동 시 RabbitMQ를 통한 메시지 동기화 확인
- Nginx 리버스 프록시를 통한 WebSocket 로드밸런싱 구성
- 기존 STOMP 프로토콜 계약(`/topic`, `/queue`, `/app`, `/ws`, `/ws-stomp`) 100% 유지
- 로컬 개발 시 SimpleBroker 폴백 가능 (profile 기반 전환)

**Non-Goals:**
- 방당 500명 이상 부하 테스트 (별도 Epic에서 수행)
- Graceful Shutdown / 세션 이관 (Epic 3 범위)
- Redis Pub/Sub 세션 동기화 (Epic 3 범위)
- 프로덕션 배포 자동화 (CI/CD)
- TLS/SSL 설정

## Decisions

### 1. 메시지 브로커: RabbitMQ

**선택:** RabbitMQ 3.13 (STOMP 플러그인 활성화)

**대안 검토:**
| 옵션 | 장점 | 단점 | 결론 |
|------|------|------|------|
| RabbitMQ | STOMP 네이티브 지원, Spring `StompBrokerRelay` 직접 연결, 변경 최소 | 별도 컨테이너 추가 | **채택** |
| Redis Streams | 이미 Redis 사용 중, 인프라 추가 불필요 | STOMP relay 직접 구현 필요, 커스텀 코드량 대폭 증가 | 기각 |
| Kafka | 대규모 이벤트 스트리밍 강점 | 3,000명 규모에 오버스펙, STOMP 통합 없음, Zookeeper/KRaft 추가 | 기각 |

**근거:** Spring의 `StompBrokerRelay`가 RabbitMQ STOMP 플러그인과 네이티브 통합되어, `WebSocketConfig` 한 파일만 수정하면 전환 완료. 기존 클라이언트 코드 변경 없음.

### 2. STOMP Relay 연결 방식

**선택:** `enableStompBrokerRelay("/topic", "/queue")` + Reactor Netty TCP 클라이언트

**구현:**
```java
config.enableStompBrokerRelay("/topic", "/queue")
    .setRelayHost(rabbitHost)
    .setRelayPort(61613)           // RabbitMQ STOMP 포트
    .setClientLogin(rabbitLogin)
    .setClientPasscode(rabbitPasscode)
    .setSystemLogin(rabbitLogin)
    .setSystemPasscode(rabbitPasscode);
```

**의존성 추가:** `io.projectreactor.netty:reactor-netty` (StompBrokerRelay의 TCP 클라이언트로 필수)

### 3. Profile 기반 브로커 전환

**선택:** `spring.profiles.active`로 SimpleBroker / RabbitMQ 전환

- **default / test 프로파일:** SimpleBroker 유지 (로컬 개발, 단위 테스트)
- **docker / scale 프로파일:** RabbitMQ StompBrokerRelay 사용

**구현:** `@ConditionalOnProperty` 또는 `@Profile`로 WebSocketConfig를 분리하여, RabbitMQ가 없는 환경에서도 기존 동작 보장.

### 4. Nginx 로드밸런싱

**선택:** Nginx 1.25+ 리버스 프록시, WebSocket Upgrade 지원

**구성:**
```
upstream chat-servers {
    server chat-server-1:8080;
    server chat-server-2:8080;
}
```

- WebSocket Upgrade 헤더 전달 (`Upgrade`, `Connection`)
- `ip_hash` 또는 기본 라운드 로빈 — RabbitMQ가 메시지 동기화를 담당하므로 sticky session 불필요
- 헬스체크: `/actuator/health` 엔드포인트 활용

**포트 매핑:**
- Nginx: **80** (HTTP) → 외부 진입점
- chat-server-1: 8080 (내부)
- chat-server-2: 8080 (내부)
- api-server: 8081 (Nginx 경유 또는 직접)

### 5. Docker Compose 다중 인스턴스 전략

**선택:** `profiles: ["scale"]`로 확장 구성 분리

- `docker compose up` → 기존 단일 인스턴스 (SimpleBroker)
- `docker compose --profile scale up` → RabbitMQ + Nginx + chat-server 2대

**근거:** 기존 개발 워크플로우를 깨지 않으면서 확장 구성을 선택적으로 활성화.

## Risks / Trade-offs

**[RabbitMQ 단일 장애점]** → 프로덕션에서는 RabbitMQ 클러스터링 필요. Phase 3에서는 단일 인스턴스로 시작하고, 모니터링(Epic 4) 후 클러스터링 검토.

**[Nginx 추가로 네트워크 홉 증가]** → WebSocket은 초기 핸드셰이크 후 persistent connection이므로 latency 영향 미미. 오히려 로드밸런싱 이점이 큼.

**[로컬 개발 복잡도 증가]** → profile 기반 전환으로 완화. `docker compose up`만으로 기존과 동일하게 동작.

**[RabbitMQ STOMP 플러그인 성능]** → RabbitMQ STOMP는 내부적으로 AMQP로 변환. 방당 500명 규모에서는 충분하나, 1,000명 이상 시 벤치마크 필요.

**[기존 테스트 호환성]** → SimpleBroker 프로파일 유지로 단위 테스트 영향 없음. 통합 테스트에서 RabbitMQ Testcontainer 추가 검토.

## Migration Plan

1. **RabbitMQ 컨테이너 추가** — docker-compose.yml에 RabbitMQ 서비스 추가, STOMP 플러그인 활성화
2. **의존성 추가** — `reactor-netty` build.gradle에 추가
3. **WebSocketConfig 분리** — Profile 기반으로 SimpleBroker / StompBrokerRelay 전환 구성
4. **application.yml 설정 추가** — RabbitMQ 접속 정보 환경 변수화
5. **Nginx 구성 추가** — nginx.conf, docker-compose에 Nginx 서비스 추가
6. **chat-server 2인스턴스 구성** — scale 프로파일에서 chat-server 2대 기동
7. **클라이언트 환경 변수 수정** — Nginx 프록시 경유하도록 변경
8. **검증** — 2인스턴스 간 메시지 동기화, WebSocket 연결 안정성 확인

**롤백:** profile을 다시 default로 전환하면 SimpleBroker로 즉시 복귀 가능.

## Open Questions

- api-server도 Nginx 경유할 것인가, 아니면 별도 포트로 직접 접근 유지할 것인가?
- RabbitMQ Management UI(15672)를 외부에 노출할 것인가? (개발 편의 vs 보안)
- scale 프로파일 시 클라이언트 컨테이너도 Nginx 경유로 자동 전환할 것인가?
