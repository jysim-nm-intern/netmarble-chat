## ADDED Requirements

### Requirement: chat-server 다중 인스턴스 메시지 동기화
서로 다른 chat-server 인스턴스에 연결된 클라이언트들이 동일한 채팅방의 메시지를 실시간으로 수신해야 한다(SHALL). RabbitMQ가 인스턴스 간 메시지 브릿지 역할을 수행한다.

#### Scenario: 크로스 인스턴스 메시지 수신
- **WHEN** 사용자 A가 chat-server-1에 연결하고, 사용자 B가 chat-server-2에 연결한 상태에서, 사용자 A가 채팅방에 메시지를 발행한다
- **THEN** 사용자 B가 동일한 메시지를 실시간으로 수신한다

#### Scenario: 3인 이상 크로스 인스턴스 메시지 전파
- **WHEN** 사용자 A(server-1), 사용자 B(server-2), 사용자 C(server-1)가 동일 채팅방에 접속한 상태에서, 사용자 B가 메시지를 발행한다
- **THEN** 사용자 A와 사용자 C 모두 해당 메시지를 실시간으로 수신한다

### Requirement: Docker Compose 다중 인스턴스 구성
docker-compose.yml은 `scale` 프로파일에서 chat-server 2인스턴스를 기동하고, 각 인스턴스가 동일한 RabbitMQ, MySQL, MongoDB, Redis에 연결해야 한다(SHALL).

#### Scenario: scale 프로파일 2인스턴스 기동
- **WHEN** `docker compose --profile scale up`을 실행한다
- **THEN** chat-server-1과 chat-server-2 컨테이너가 각각 기동되고, 두 인스턴스 모두 RabbitMQ에 STOMP 연결을 수립한다

#### Scenario: 각 인스턴스의 독립적 데이터 소스 연결
- **WHEN** chat-server-1과 chat-server-2가 기동된다
- **THEN** 두 인스턴스 모두 동일한 MySQL, MongoDB, Redis에 연결하여 데이터 일관성을 유지한다

### Requirement: 클라이언트 프록시 경유 연결
scale 프로파일에서 프론트엔드 클라이언트는 Nginx 프록시를 통해 chat-server에 연결해야 한다(SHALL). 직접 chat-server 포트 접근 대신 Nginx(포트 80)을 진입점으로 사용한다.

#### Scenario: 클라이언트 환경 변수 Nginx 지향
- **WHEN** `scale` 프로파일로 클라이언트 컨테이너가 기동된다
- **THEN** `VITE_WS_TARGET`이 Nginx 주소(예: `ws://nginx:80`)를 가리키고, WebSocket 연결이 Nginx를 경유한다

### Requirement: 읽음 상태 및 이벤트 크로스 인스턴스 전파
입장/퇴장 이벤트, 읽음 상태 업데이트 등 STOMP로 전파되는 모든 이벤트가 다중 인스턴스 환경에서도 모든 구독자에게 전달되어야 한다(SHALL).

#### Scenario: 입장 이벤트 크로스 인스턴스 수신
- **WHEN** 사용자 A(server-1)가 채팅방에 입장하고, 사용자 B(server-2)가 동일 채팅방에 접속 중이다
- **THEN** 사용자 B가 사용자 A의 입장 이벤트를 수신한다

#### Scenario: 읽음 상태 크로스 인스턴스 업데이트
- **WHEN** 사용자 A(server-1)가 채팅방의 메시지를 읽고 읽음 상태가 STOMP로 전파된다
- **THEN** 사용자 B(server-2)가 해당 읽음 상태 업데이트를 수신한다
