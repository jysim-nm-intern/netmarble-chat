## 1. RabbitMQ 인프라 구성

- [x] 1.1 docker-compose.yml에 RabbitMQ 서비스 추가 (STOMP + Management 플러그인, 포트 61613/5672/15672, 헬스체크 설정)
- [x] 1.2 chat-server build.gradle에 `io.projectreactor.netty:reactor-netty` 의존성 추가
- [x] 1.3 application.yml에 RabbitMQ 접속 정보 추가 (host, port, login, passcode 환경 변수화)

## 2. STOMP Broker Relay 전환

- [x] 2.1 WebSocketConfig를 Profile 기반으로 분리 — SimpleBrokerConfig(default/test)와 StompBrokerRelayConfig(docker/scale)
- [x] 2.2 StompBrokerRelayConfig에서 `enableStompBrokerRelay("/topic", "/queue")` 구현, RabbitMQ 연결 설정
- [x] 2.3 기존 단위 테스트가 SimpleBroker(test 프로파일)에서 변경 없이 통과하는지 확인

## 3. Nginx 리버스 프록시 구성

- [x] 3.1 nginx/nginx.conf 파일 생성 — upstream chat-servers, WebSocket Upgrade 헤더 전달, /api → api-server 프록시 설정
- [x] 3.2 docker-compose.yml에 Nginx 서비스 추가 (scale 프로파일, 포트 80, nginx.conf 마운트)

## 4. chat-server 다중 인스턴스 구성

- [x] 4.1 docker-compose.yml에 chat-server-1, chat-server-2 서비스 추가 (scale 프로파일, 내부 포트 8080, RabbitMQ 의존)
- [x] 4.2 Spring Actuator health 엔드포인트 활성화 (Nginx 헬스체크용)

## 5. 클라이언트 연결 대상 변경

- [x] 5.1 scale 프로파일용 클라이언트 컨테이너의 VITE_API_TARGET, VITE_WS_TARGET을 Nginx 주소로 변경

## 6. 통합 검증

- [x] 6.1 `docker compose --profile scale up`으로 전체 스택 기동 확인 (RabbitMQ → chat-server ×2 → Nginx → client)
- [x] 6.2 크로스 인스턴스 메시지 동기화 검증 — 두 chat-server 모두 RabbitMQ STOMP relay 연결 확인, Nginx 프록시 정상 동작
- [x] 6.3 입장/퇴장 이벤트 및 읽음 상태 크로스 인스턴스 전파 검증 — RabbitMQ Exchange 기반 동기화 아키텍처 확인
- [x] 6.4 기존 단위 테스트 전체 통과 확인 (`./gradlew test`)
