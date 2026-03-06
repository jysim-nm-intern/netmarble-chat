## Context

현재 이미지(프로필, 채팅방 썸네일, 메시지 첨부)를 Base64 Data URL로 인코딩하여 DB MEDIUMTEXT 컬럼에 저장하고 있다. 이 방식은 Phase 2까지의 프로토타이핑에서는 편리했으나, 다중 인스턴스 환경(Phase 3)에서는 DB 부하, 네트워크 페이로드 증가, 확장성 한계가 명확하다.

**현재 이미지 처리 흐름:**
1. 클라이언트 → `multipart/form-data` 업로드
2. 컨트롤러 → `Base64.getEncoder().encodeToString(bytes)` 인코딩
3. DB 저장 → `MEDIUMTEXT` 컬럼에 `data:image/png;base64,...` 전체 저장
4. 조회 시 → Base64 문자열이 JSON 응답에 포함되어 전송

**제약 사항:**
- S3/MinIO 등 오브젝트 스토리지 사용 불가 → 로컬 파일 시스템 사용
- 다중 인스턴스(chat-server-1/2)에서 동일 파일 접근 필요 → Docker shared volume
- 기존 API 응답 JSON 구조(`attachmentUrl`, `profileImage`, `imageUrl`) 유지

## Goals / Non-Goals

**Goals:**
- Base64 인코딩 제거 — 이미지를 파일 시스템에 저장하고 URL로 참조
- DB 레코드 크기 90% 이상 감소 (이미지 포함 메시지 기준)
- Nginx static serving으로 chat-server 부하 분산
- 다중 인스턴스 환경에서 Docker shared volume으로 파일 공유
- 기존 API 응답 구조 유지 (호환성)

**Non-Goals:**
- CDN 연동, 이미지 리사이징/썸네일 생성, WebP 변환
- 기존 Base64 데이터 마이그레이션 (신규 업로드부터 적용, 기존 데이터는 그대로 유지)
- S3/MinIO 등 외부 오브젝트 스토리지 도입

## Decisions

### D1. 파일 저장 경로 구조

**결정:** `/data/uploads/{type}/{yyyy/MM/dd}/{uuid}.{ext}` 형식

- `type`: `profiles`, `rooms`, `messages` (용도별 분리)
- 날짜 디렉토리: 일별 디렉토리로 파일 분산 (단일 디렉토리 inode 과부하 방지)
- UUID v4 파일명: 충돌 방지 + 원본 파일명 추론 불가 (보안)

**대안:** 단순 `{uuid}.{ext}` → inode 한계 도달 가능성, 관리 어려움

### D2. 파일 서빙 방식

**결정:** Nginx `location /uploads/` → Docker volume 직접 서빙

- chat-server가 파일 I/O를 처리하지 않으므로 WAS 스레드 절약
- Nginx는 정적 파일 서빙에 최적화 (sendfile, gzip 등)
- `Cache-Control` 헤더로 브라우저 캐싱 활성화

**대안:** Spring ResourceHandler로 서빙 → WAS 스레드 소비, 불필요한 오버헤드

### D3. FileStorageService 인터페이스 설계

**결정:** `FileStorageService` 인터페이스 + `LocalFileStorageService` 구현

```java
public interface FileStorageService {
    String store(MultipartFile file, String type);  // 반환: "/uploads/messages/2026/03/04/uuid.jpg"
    void delete(String filePath);
}
```

- DDD 원칙: 도메인이 저장소 구현에 의존하지 않음
- 향후 S3 전환 시 `S3FileStorageService` 구현만 추가

### D4. DB 컬럼 변경

**결정:** `file_url` VARCHAR(500) 유지 (URL 길이 충분), `profile_image`/`image_url` 타입 축소는 별도 마이그레이션으로 분리

- Base64 Data URL (수 MB) → URL 문자열 (~100자)이므로 VARCHAR(500) 적합
- 기존 Base64 데이터가 있는 레코드는 그대로 유지 (하위 호환)

### D5. 업로드 용량 제한

**결정:** Spring `multipart.max-file-size=5MB` + Nginx `client_max_body_size 10m`

- Nginx에서 1차 차단 (10MB), Spring에서 2차 검증 (5MB)
- 메시지 이미지 업로드의 기존 7.5MB 제한을 5MB로 통일 (SDD 명세 준수)

### D6. Docker Volume 구성

**결정:** `docker-compose.yml`에 named volume `upload-data` 추가

```yaml
volumes:
  upload-data:

services:
  chat-server-1:
    volumes:
      - upload-data:/data/uploads
  chat-server-2:
    volumes:
      - upload-data:/data/uploads
  nginx:
    volumes:
      - upload-data:/data/uploads:ro  # 읽기 전용
```

## Risks / Trade-offs

- **[단일 노드 장애]** 로컬 파일 시스템은 디스크 장애 시 데이터 유실 → Docker volume 백업 정책으로 완화 (프로덕션에서는 NFS/S3 전환 권장)
- **[디스크 용량]** 이미지 누적 시 디스크 부족 가능 → 업로드 용량 제한(5MB) + 모니터링으로 사전 대응
- **[기존 Base64 호환]** 신규 업로드만 URL 방식 적용, 기존 Base64 데이터는 프론트엔드에서 두 형식 모두 렌더링 가능하도록 유지 → `<img src>` 태그는 Base64 Data URL과 HTTP URL 모두 지원하므로 변경 없음
- **[파일 삭제 동기화]** 메시지 삭제 시 파일도 삭제해야 하는데, 현재 메시지 삭제 기능이 soft delete → 파일 삭제는 별도 배치 작업으로 분리 (Phase 3 범위 외)
