## ADDED Requirements

### Requirement: RabbitMQ STOMP Relay 연결
시스템은 `scale` 프로파일 활성화 시 RabbitMQ STOMP 플러그인(포트 61613)에 StompBrokerRelay로 연결하여 `/topic` 및 `/queue` 목적지의 메시지를 라우팅해야 한다(SHALL). Docker Compose에서는 `SPRING_PROFILES_ACTIVE=docker,scale`로 설정한다.

#### Scenario: scale 프로파일에서 RabbitMQ 연결 성공
- **WHEN** `SPRING_PROFILES_ACTIVE=docker,scale`로 chat-server를 기동한다
- **THEN** StompBrokerRelay가 RabbitMQ의 STOMP 포트(61613)에 TCP 연결을 수립하고, 시스템 로그에 "Connected to RabbitMQ STOMP broker" 수준의 연결 성공 로그가 출력된다

#### Scenario: RabbitMQ 미실행 시 기동 실패
- **WHEN** RabbitMQ가 실행되지 않은 상태에서 `SPRING_PROFILES_ACTIVE=docker,scale`로 chat-server를 기동한다
- **THEN** 시스템은 RabbitMQ 연결 실패 예외를 발생시키고 정상 기동되지 않는다

### Requirement: SimpleBroker 폴백 유지
시스템은 `default` 또는 `test` 프로파일에서 기존 SimpleBroker를 사용하여 외부 브로커 없이 동작해야 한다(SHALL).

#### Scenario: default 프로파일에서 SimpleBroker 동작
- **WHEN** 프로파일 지정 없이 chat-server를 기동한다
- **THEN** SimpleBroker가 활성화되어 `/topic`, `/queue` 메시지를 JVM 내 메모리로 라우팅하고, RabbitMQ 연결을 시도하지 않는다

#### Scenario: test 프로파일에서 SimpleBroker 동작
- **WHEN** `SPRING_PROFILES_ACTIVE=test`로 단위 테스트를 실행한다
- **THEN** SimpleBroker가 활성화되어 기존 테스트가 변경 없이 통과한다

### Requirement: RabbitMQ Docker 컨테이너 제공
docker-compose.yml은 RabbitMQ 서비스를 포함하여 STOMP 플러그인과 Management 플러그인이 활성화된 상태로 기동해야 한다(SHALL).

#### Scenario: docker compose로 RabbitMQ 기동
- **WHEN** `docker compose --profile scale up`을 실행한다
- **THEN** RabbitMQ 컨테이너가 기동되고, STOMP 포트(61613)와 AMQP 포트(5672)가 리스닝 상태가 된다

#### Scenario: RabbitMQ 헬스체크 통과
- **WHEN** RabbitMQ 컨테이너가 기동 완료된다
- **THEN** `rabbitmq-diagnostics -q ping` 헬스체크가 성공하고, 의존 서비스(chat-server)가 기동을 시작한다

### Requirement: STOMP 프로토콜 계약 유지
RabbitMQ 전환 후에도 기존 STOMP 목적지(`/topic/chatroom.{id}`, `/queue/...`) 및 발행 경로(`/app/...`)가 동일하게 동작해야 한다(SHALL). RabbitMQ STOMP 플러그인은 `/topic/` 접두사 이후 `/` 구분자를 허용하지 않으므로 `.` 구분자를 사용한다.

#### Scenario: 채팅 메시지 발행 및 구독
- **WHEN** 클라이언트가 `/app/chat/message`로 메시지를 발행한다
- **THEN** `/topic/chatroom.{roomId}`를 구독 중인 모든 클라이언트가 해당 메시지를 수신한다

#### Scenario: WebSocket 엔드포인트 유지
- **WHEN** 클라이언트가 `/ws`(SockJS) 또는 `/ws-stomp`(네이티브)로 연결을 시도한다
- **THEN** 기존과 동일하게 STOMP 세션이 수립된다

### Requirement: Reactor Netty 의존성
chat-server의 build.gradle에 `io.projectreactor.netty:reactor-netty` 의존성이 포함되어야 한다(SHALL). StompBrokerRelay의 TCP 클라이언트로 필수이다.

#### Scenario: 의존성 해결
- **WHEN** `./gradlew dependencies`를 실행한다
- **THEN** `reactor-netty` 라이브러리가 런타임 클래스패스에 포함된다
