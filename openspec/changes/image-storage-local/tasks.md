## 1. FileStorageService 구현

- [x] 1.1 `FileStorageService` 인터페이스 정의 (`store(MultipartFile, String type)` → URL 반환, `delete(String filePath)`)
- [x] 1.2 `LocalFileStorageService` 구현 — UUID 파일명 생성, 날짜별 디렉토리 자동 생성, 파일 저장
- [x] 1.3 파일 확장자 검증 (JPG/JPEG/PNG/GIF만 허용) 및 크기 제한 (5MB) 로직 구현
- [x] 1.4 `application.yml`에 업로드 경로 설정 (`file.upload-dir=/data/uploads`) 및 Spring `multipart.max-file-size=5MB` 설정
- [x] 1.5 `FileStorageService` 단위 테스트 작성 (저장, 삭제, 확장자 검증, 크기 제한)

## 2. 이미지 업로드 API 전환

- [x] 2.1 `ChatRoomController.uploadImage()` — Base64 인코딩 제거, `FileStorageService.store()` 호출로 교체
- [x] 2.2 `UserController.createUser()` — 프로필 이미지 Base64 인코딩 제거, `FileStorageService.store("profiles")` 호출로 교체
- [x] 2.3 `ChatRoomController.createChatRoom()` — 채팅방 썸네일 Base64 인코딩 제거, `FileStorageService.store("rooms")` 호출로 교체
- [x] 2.4 기존 `encodeImageToBase64()` 헬퍼 메서드 제거
- [x] 2.5 컨트롤러 단위 테스트 업데이트 (FileStorageService Mock 주입, URL 반환 검증)

## 3. Nginx 정적 파일 서빙 설정

- [x] 3.1 `nginx.conf`에 `location /uploads/` 블록 추가 — Docker volume 직접 서빙, `Cache-Control` 헤더
- [x] 3.2 `nginx.conf`에 `client_max_body_size 10m` 설정 추가
- [x] 3.3 `docker-compose.yml`에 `upload-data` named volume 추가 — chat-server-1/2 (rw), nginx (ro) 마운트
- [x] 3.4 로컬 개발 환경용 Spring ResourceHandler 폴백 설정 (Docker 없이 `/uploads/` 서빙)

## 4. 프론트엔드 업데이트

- [x] 4.1 `MessageList.jsx` 이미지 렌더링 검토 — Base64 URL과 HTTP URL 모두 `<img src>` 호환 확인
- [x] 4.2 프로필 이미지 / 채팅방 썸네일 렌더링 검토 — URL 형태 변경에 따른 호환성 확인
- [x] 4.3 클라이언트 단위 테스트 업데이트 (URL 형태 변경 반영)

## 5. 통합 검증

- [x] 5.1 서버 단위 테스트 전체 통과 확인 (`./gradlew test`)
- [x] 5.2 클라이언트 단위 테스트 전체 통과 확인 (`npm test`)
- [ ] 5.3 E2E 테스트 — 이미지 업로드 및 렌더링 시나리오 통과 확인 (normal 모드)
- [ ] 5.4 Docker scale 모드에서 크로스 인스턴스 이미지 업로드/조회 검증
