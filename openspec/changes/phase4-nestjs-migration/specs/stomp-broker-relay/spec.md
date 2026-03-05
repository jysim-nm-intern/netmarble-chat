## MODIFIED Requirements

### Requirement: RabbitMQ STOMP Relay 연결
시스템은 `scale` 모드(환경변수 `NODE_ENV=scale` 또는 `SCALE_MODE=true`) 활성화 시 RabbitMQ STOMP 플러그인(포트 61613)에 연결하여 `/topic` 및 `/queue` 목적지의 메시지를 라우팅해야 한다(SHALL). NestJS에서는 STOMP 클라이언트 라이브러리를 통해 RabbitMQ에 연결한다.

#### Scenario: scale 모드에서 RabbitMQ 연결 성공
- **WHEN** `SCALE_MODE=true` 환경변수로 chat-server를 기동한다
- **THEN** STOMP 클라이언트가 RabbitMQ의 STOMP 포트(61613)에 연결을 수립하고, 로그에 연결 성공 메시지가 출력된다

#### Scenario: RabbitMQ 미실행 시 기동 실패
- **WHEN** RabbitMQ가 실행되지 않은 상태에서 `SCALE_MODE=true`로 chat-server를 기동한다
- **THEN** 시스템은 RabbitMQ 연결 실패 에러를 발생시키고 정상 기동되지 않는다

### Requirement: SimpleBroker 폴백 유지
시스템은 기본 모드(scale 미설정)에서 인메모리 STOMP 브로커(`stomp-broker-js` 또는 동등 구현)를 사용하여 외부 브로커 없이 동작해야 한다(SHALL).

#### Scenario: 기본 모드에서 인메모리 브로커 동작
- **WHEN** 환경변수 없이 chat-server를 기동한다
- **THEN** 인메모리 STOMP 브로커가 활성화되어 `/topic`, `/queue` 메시지를 프로세스 내 메모리로 라우팅하고, RabbitMQ 연결을 시도하지 않는다

#### Scenario: 테스트 환경에서 인메모리 브로커 동작
- **WHEN** `NODE_ENV=test`로 단위 테스트를 실행한다
- **THEN** 인메모리 STOMP 브로커가 활성화되어 테스트가 외부 의존성 없이 통과한다

### Requirement: RabbitMQ Docker 컨테이너 제공
docker-compose.yml은 RabbitMQ 서비스를 포함하여 STOMP 플러그인과 Management 플러그인이 활성화된 상태로 기동해야 한다(SHALL). 기존 설정을 그대로 유지한다.

#### Scenario: docker compose로 RabbitMQ 기동
- **WHEN** `docker compose --profile scale up`을 실행한다
- **THEN** RabbitMQ 컨테이너가 기동되고, STOMP 포트(61613)와 AMQP 포트(5672)가 리스닝 상태가 된다

#### Scenario: RabbitMQ 헬스체크 통과
- **WHEN** RabbitMQ 컨테이너가 기동 완료된다
- **THEN** `rabbitmq-diagnostics -q ping` 헬스체크가 성공하고, 의존 서비스(chat-server)가 기동을 시작한다

### Requirement: STOMP 프로토콜 계약 유지
NestJS 전환 후에도 기존 STOMP 목적지(`/topic/chatroom.{id}`, `/queue/...`) 및 발행 경로(`/app/...`)가 동일하게 동작해야 한다(SHALL).

#### Scenario: 채팅 메시지 발행 및 구독
- **WHEN** 클라이언트가 `/app/chat.message`로 메시지를 발행한다
- **THEN** `/topic/chatroom.{roomId}`를 구독 중인 모든 클라이언트가 해당 메시지를 수신한다

#### Scenario: WebSocket 엔드포인트 유지
- **WHEN** 클라이언트가 `/ws`(SockJS) 또는 `/ws-stomp`(네이티브)로 연결을 시도한다
- **THEN** 기존과 동일하게 STOMP 세션이 수립된다

### Requirement: Node.js STOMP 서버 라이브러리
chat-server의 package.json에 STOMP 서버 기능을 제공하는 라이브러리(예: `stomp-broker-js`)가 포함되어야 한다(SHALL). Spring의 `reactor-netty` 의존성은 Node.js에서 불필요하다.

#### Scenario: STOMP 의존성 설치
- **WHEN** `npm ls`를 실행한다
- **THEN** STOMP 서버 관련 라이브러리가 dependencies에 포함된다
