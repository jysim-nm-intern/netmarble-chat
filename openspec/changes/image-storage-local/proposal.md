## Why

현재 이미지(프로필, 채팅방 썸네일, 메시지 첨부)를 Base64 Data URL로 인코딩하여 DB(MEDIUMTEXT)에 직접 저장하고 있다. 이 방식은 DB 레코드 크기 비대화, 쿼리 성능 저하, WebSocket/REST 응답 페이로드 증가를 유발한다. Phase 2 부하 테스트에서 이미지 포함 메시지 조회 시 응답 크기가 수십 배 증가하는 병목이 확인되었다. Phase 3에서 다중 인스턴스 환경(RabbitMQ + Nginx)이 도입된 만큼, 파일 저장소를 분리하여 DB 부하를 줄이고 이미지 서빙 성능을 개선해야 한다.

**제약:** S3/MinIO 사용 불가 → 로컬 파일 시스템 기반으로 구현하며, 다중 인스턴스 환경에서는 Docker shared volume을 사용한다. 파일 서빙은 Nginx static serving으로 처리한다.

## What Changes

- **FileStorageService 구현:** 이미지 파일을 로컬 디스크(`/data/uploads/`)에 UUID 기반 파일명으로 저장하고 접근 URL을 반환하는 서비스
- **이미지 업로드 API 통합:** 기존 컨트롤러 내 Base64 인코딩 로직을 FileStorageService 호출로 교체
  - 프로필 이미지 (`POST /api/users`)
  - 채팅방 썸네일 (`POST /api/chat-rooms`)
  - 메시지 이미지 (`POST /api/chat-rooms/{id}/messages/upload`)
- **Attachment 모델 변경:** `file_url`에 Base64 대신 파일 경로 URL 저장 (`/uploads/uuid.jpg`)
- **Nginx static serving 설정:** `/uploads/` 경로를 Nginx에서 직접 서빙하여 chat-server 부하 제거
- **Docker shared volume 설정:** chat-server-1/2가 동일한 업로드 디렉토리를 공유
- **프론트엔드 이미지 로딩 업데이트:** Base64 Data URL 대신 HTTP URL로 `<img>` 렌더링 (변경 최소화 — `src` 값만 URL로 전환)

## Capabilities

### New Capabilities
- `file-storage-service`: 로컬 파일 시스템 기반 이미지 저장/조회 서비스 (UUID 파일명, 디렉토리 구조, 용량 검증)
- `nginx-static-serving`: Nginx를 통한 업로드 파일 정적 서빙 설정 및 Docker volume 마운트

### Modified Capabilities
- `image-upload`: 기존 Base64 인코딩 업로드 흐름을 FileStorageService 기반 파일 저장 + URL 반환으로 변경

## Impact

- **Server:** `UserController`, `ChatRoomController`, `MessageApplicationService` — Base64 인코딩 제거, FileStorageService 주입
- **Domain:** `Attachment.fileUrl` — Base64 Data URL → 파일 경로 URL (`/uploads/uuid.ext`)
- **Infra:** `docker-compose.yml` — shared volume 추가, Nginx location 블록 추가
- **Frontend:** `MessageList.jsx`, `MessageInput.jsx` — 이미지 렌더링 src 속성 변경 없음 (URL 형태만 달라짐)
- **DB:** `user.profile_image`, `chat_room.image_url` 컬럼 타입을 MEDIUMTEXT에서 VARCHAR(500)으로 축소 가능
- **API 호환성:** 응답 JSON 구조 변경 없음 (`attachmentUrl` 필드에 URL 문자열 반환)
