## ADDED Requirements

### Requirement: Nginx 리버스 프록시 WebSocket 지원
Nginx는 클라이언트의 WebSocket Upgrade 요청을 upstream chat-server로 정확히 전달해야 한다(SHALL).

#### Scenario: WebSocket 핸드셰이크 성공
- **WHEN** 클라이언트가 Nginx(포트 80)의 `/ws` 경로로 WebSocket Upgrade 요청을 보낸다
- **THEN** Nginx가 `Upgrade: websocket` 및 `Connection: Upgrade` 헤더를 upstream으로 전달하고, 클라이언트와 chat-server 간 WebSocket 연결이 수립된다

#### Scenario: SockJS 폴백 지원
- **WHEN** 클라이언트가 Nginx의 `/ws/info` 또는 `/ws/{server}/{session}/websocket` 경로로 SockJS 요청을 보낸다
- **THEN** Nginx가 해당 요청을 upstream chat-server로 정상 프록시한다

### Requirement: chat-server 라운드 로빈 로드밸런싱
Nginx는 upstream에 등록된 chat-server 인스턴스들에게 라운드 로빈 방식으로 새 연결을 분배해야 한다(SHALL).

#### Scenario: 2인스턴스 연결 분배
- **WHEN** 4개의 클라이언트가 순차적으로 Nginx를 통해 WebSocket 연결을 수립한다
- **THEN** chat-server-1과 chat-server-2에 각각 약 2개씩 연결이 분배된다

### Requirement: upstream 헬스체크
Nginx는 비정상 chat-server 인스턴스를 감지하고 트래픽 전달에서 제외해야 한다(SHALL).

#### Scenario: 인스턴스 장애 시 자동 제외
- **WHEN** chat-server-1이 중단된 상태에서 클라이언트가 새 WebSocket 연결을 시도한다
- **THEN** Nginx가 chat-server-2로만 연결을 라우팅한다

### Requirement: API 프록시 경로 구성
Nginx는 REST API 요청(`/api/**`)을 api-server로, WebSocket 요청(`/ws`, `/ws-stomp`)을 chat-server upstream으로 라우팅해야 한다(SHALL).

#### Scenario: REST API 요청 라우팅
- **WHEN** 클라이언트가 Nginx의 `/api/chatrooms` 경로로 GET 요청을 보낸다
- **THEN** Nginx가 해당 요청을 api-server(8081)로 프록시한다

#### Scenario: STOMP 요청 라우팅
- **WHEN** 클라이언트가 Nginx의 `/ws` 경로로 WebSocket 연결을 요청한다
- **THEN** Nginx가 해당 요청을 chat-server upstream으로 프록시한다

### Requirement: Nginx Docker 컨테이너 구성
docker-compose.yml은 Nginx 서비스를 `scale` 프로파일에 포함하여 포트 80으로 외부 트래픽을 수신해야 한다(SHALL).

#### Scenario: scale 프로파일에서 Nginx 기동
- **WHEN** `docker compose --profile scale up`을 실행한다
- **THEN** Nginx 컨테이너가 기동되고 포트 80에서 리스닝하며, upstream chat-server들에 대한 프록시가 활성화된다
