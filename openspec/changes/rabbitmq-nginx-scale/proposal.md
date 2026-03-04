## Why

Phase 2 부하 테스트에서 SimpleBroker의 **단일 방 200명 동시 접속 한계**가 확인되었으며, chat-server가 단일 인스턴스로만 운영되어 수평 확장이 불가능하다. RabbitMQ 외부 브로커 도입 + Nginx 로드밸런싱으로 방당 500명, 전체 3,000명 동시 접속을 지원하는 확장 가능한 아키텍처로 전환한다.

## What Changes

- **SimpleBroker → RabbitMQ STOMP Relay 전환:** `WebSocketConfig`의 `enableSimpleBroker()` → `enableStompBrokerRelay()`로 교체, RabbitMQ에 STOMP 플러그인 활성화하여 연결
- **RabbitMQ Docker 컨테이너 추가:** `docker-compose.yml`에 RabbitMQ 서비스 추가 (STOMP 플러그인, Management UI 포함)
- **Spring STOMP Reactor Netty 의존성 추가:** `build.gradle`에 `reactor-netty` 의존성 추가 (StompBrokerRelay 필수)
- **Nginx 리버스 프록시 구성:** WebSocket Upgrade 지원, chat-server upstream 라운드 로빈, 헬스체크 기반 라우팅
- **chat-server 2인스턴스 구성:** Docker Compose에서 chat-server `deploy.replicas: 2` 또는 명시적 2개 서비스로 다중 인스턴스 기동
- **프론트엔드 연결 대상 변경:** 클라이언트가 chat-server 직접 접속 대신 Nginx 프록시 경유하도록 환경 변수 수정
- **application.yml 프로파일 추가:** RabbitMQ 접속 정보(host, port, login, passcode) 환경 변수화

## Capabilities

### New Capabilities
- `stomp-broker-relay`: SimpleBroker를 RabbitMQ STOMP Relay로 전환하여 외부 브로커 기반 메시지 라우팅을 수행하는 기능
- `nginx-load-balancer`: Nginx 리버스 프록시를 통한 WebSocket 로드밸런싱 및 chat-server 다중 인스턴스 라우팅 기능
- `multi-instance-chat`: chat-server 2인스턴스 구성 및 인스턴스 간 메시지 동기화 검증 기능

### Modified Capabilities
<!-- 기존 스펙 변경 없음 — WebSocket/STOMP 프로토콜 계약(/topic, /app, /ws)은 동일하게 유지 -->

## Impact

- **chat-server:** `WebSocketConfig.java` 수정, `build.gradle` 의존성 추가, `application.yml` RabbitMQ 설정 추가
- **docker-compose.yml:** RabbitMQ 서비스, Nginx 서비스 추가, chat-server 다중 인스턴스 구성
- **client:** `VITE_API_TARGET`, `VITE_WS_TARGET` 환경 변수를 Nginx 프록시 주소로 변경
- **인프라 의존성 추가:** RabbitMQ 3.13+, Nginx 1.25+
- **기존 STOMP 계약 유지:** `/topic`, `/queue`, `/app` 경로 및 `/ws`, `/ws-stomp` 엔드포인트 변경 없음 — 클라이언트 STOMP 코드 수정 불필요
