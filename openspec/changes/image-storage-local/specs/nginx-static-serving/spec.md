## ADDED Requirements

### Requirement: Nginx 정적 파일 서빙
Nginx는 `/uploads/` 경로의 요청을 Docker volume에서 직접 서빙해야 한다(SHALL). chat-server를 거치지 않고 파일을 반환한다.

#### Scenario: 업로드된 이미지 조회
- **WHEN** 브라우저가 `GET /uploads/messages/2026/03/04/uuid.jpg`를 요청한다
- **THEN** Nginx가 `/data/uploads/messages/2026/03/04/uuid.jpg` 파일을 직접 응답하고, `Content-Type: image/jpeg` 헤더를 포함한다

#### Scenario: 존재하지 않는 파일 요청
- **WHEN** 브라우저가 존재하지 않는 `/uploads/nonexistent.jpg`를 요청한다
- **THEN** Nginx가 HTTP 404 응답을 반환한다

### Requirement: 브라우저 캐싱 설정
Nginx는 이미지 응답에 캐시 제어 헤더를 포함하여 브라우저 캐싱을 활성화해야 한다(SHALL).

#### Scenario: 캐시 헤더 포함
- **WHEN** 브라우저가 이미지 파일을 요청한다
- **THEN** 응답에 `Cache-Control: public, max-age=31536000, immutable` 헤더가 포함된다 (UUID 파일명이므로 영구 캐싱 안전)

### Requirement: Docker Volume 공유
chat-server-1, chat-server-2, Nginx가 동일한 Docker named volume(`upload-data`)을 마운트해야 한다(SHALL).

#### Scenario: 크로스 인스턴스 파일 접근
- **WHEN** chat-server-1에서 이미지를 저장한다
- **THEN** chat-server-2와 Nginx에서 동일 경로로 해당 파일에 접근할 수 있다

### Requirement: 업로드 크기 제한
Nginx는 `client_max_body_size` 설정으로 업로드 요청의 최대 크기를 제한해야 한다(SHALL).

#### Scenario: Nginx 업로드 크기 초과
- **WHEN** 클라이언트가 10MB를 초과하는 파일을 업로드한다
- **THEN** Nginx가 HTTP 413 (Request Entity Too Large) 응답을 반환한다
