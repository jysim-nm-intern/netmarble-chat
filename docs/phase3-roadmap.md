# Phase 3 로드맵: 확장성 강화 및 프로덕션 준비

**작성일:** 2026-03-04
**기반:** Phase 2 부하 테스트 결과 및 회고 분석

---

## 목표

Phase 2에서 확인된 병목(SimpleBroker 200명/방 한계, 이미지 Base64 저장)을 해소하고,
프로덕션 수준의 확장성과 운영 안정성을 확보한다.

---

## 기술 스택 변경 예정

| 영역 | Phase 2 (현재) | Phase 3 (목표) |
|------|---------------|----------------|
| **메시지 브로커** | SimpleBroker | **RabbitMQ** (STOMP relay) |
| **이미지 저장** | Base64 문자열 (DB) | **MinIO/S3** + CDN URL |
| **서버 구성** | chat-server ×1 + api-server ×1 | chat-server **×N** + api-server ×1 |
| **모니터링** | 로그 기반 | **Prometheus + Grafana** |
| **로드밸런서** | 없음 (단일 포트) | **Nginx** 리버스 프록시 |

---

## Epic 구조

### Epic 1: 외부 메시지 브로커 도입 (RabbitMQ)

**목적:** SimpleBroker의 단일 방 200명 한계를 해소하고, chat-server 다중 인스턴스 간 메시지 동기화를 지원한다.

| 태스크 | 설명 |
|--------|------|
| RabbitMQ Docker 컨테이너 추가 | `docker-compose.yml`에 RabbitMQ 서비스 추가, STOMP 플러그인 활성화 |
| Spring STOMP Relay 설정 | `WebSocketConfig`에서 SimpleBroker → `StompBrokerRelay` 전환 (RabbitMQ 연결) |
| chat-server 다중 인스턴스 검증 | Docker Compose `deploy.replicas: 2`로 chat-server 2대 기동, 메시지 동기화 확인 |
| Nginx 로드밸런서 구성 | WebSocket 업그레이드 지원 Nginx 프록시 설정, chat-server 라운드 로빈 |
| 부하 테스트 | 방당 500명, 전체 2,000명 동시 접속 목표 |

**완료 기준:**
- 방당 500명 동시 접속 시 STOMP 오류 0건
- chat-server 2대 간 메시지 실시간 동기화 확인
- 인스턴스 추가/제거 시 무중단 확인

---

### Epic 2: 이미지 저장소 분리 (S3/MinIO)

**목적:** Base64 문자열 DB 저장 방식을 파일 스토리지(MinIO)로 전환하여 DB 부하 감소 및 이미지 전송 성능을 개선한다.

| 태스크 | 설명 |
|--------|------|
| MinIO Docker 컨테이너 추가 | S3 호환 오브젝트 스토리지, `chat-images` 버킷 생성 |
| `FileUploadService` 구현 | 이미지 업로드 → MinIO 저장 → URL 반환 |
| `Attachment` 모델 변경 | `content: Base64` → `url: String` (MinIO 경로) |
| 프론트엔드 이미지 로딩 | `<img src={attachment.url}>` 직접 로딩 (Base64 디코딩 제거) |
| 마이그레이션 스크립트 | 기존 Base64 데이터 → MinIO 파일 변환 (일회성) |

**완료 기준:**
- 이미지 업로드/조회 시 Base64 인코딩/디코딩 제거
- DB 메시지 레코드 크기 90% 이상 감소 (이미지 포함 시)
- 이미지 로딩 속도 개선 확인

---

### Epic 3: 수평 확장 및 로드밸런싱

**목적:** chat-server 다중 인스턴스 + Nginx 프록시로 수평 확장 가능한 구조를 완성한다.

| 태스크 | 설명 |
|--------|------|
| Nginx 리버스 프록시 | WebSocket 업그레이드, 헬스체크 기반 라운드 로빈 |
| Docker Compose 프로파일 | `--profile scale`로 chat-server 복제, `--profile single`로 단일 |
| Redis Pub/Sub 세션 동기화 | STOMP 세션 정보를 Redis Pub/Sub로 인스턴스 간 공유 |
| Graceful Shutdown | 인스턴스 종료 시 WebSocket 세션 안전 이관 |
| 부하 테스트 (확장 검증) | 인스턴스 1→2→3 확장 시 선형 성능 향상 확인 |

**완료 기준:**
- chat-server 3대에서 전체 3,000명 동시 접속 안정
- 인스턴스 추가 시 무중단 확인
- 부하 테스트 리포트에 Phase 3 열 추가

---

### Epic 4: 모니터링 및 운영 안정성

**목적:** 프로덕션 수준의 모니터링, 알림, 로깅 체계를 구축한다.

| 태스크 | 설명 |
|--------|------|
| Spring Actuator + Micrometer | 메트릭 수집 (JVM, HTTP, STOMP, MongoDB, Redis) |
| Prometheus 컨테이너 추가 | 메트릭 스크래핑, 알림 규칙 설정 |
| Grafana 대시보드 | 실시간 동시 접속, 메시지 처리량, 응답 시간 시각화 |
| 구조화 로깅 (JSON) | ELK 연동 대비 JSON 포맷 로깅 |
| 알림 규칙 | STOMP 오류율 > 1%, HTTP p(95) > 2s 시 알림 |

**완료 기준:**
- Grafana 대시보드에서 핵심 메트릭 실시간 모니터링 가능
- 알림 규칙 동작 확인

---

## 우선순위 및 일정 제안

```
Phase 3 Step 1 (병렬):
  ├── Epic 1: 외부 브로커 (RabbitMQ)     ← 핵심 병목 해소
  └── Epic 2: 이미지 저장소 (MinIO)       ← DB 부하 감소

Phase 3 Step 2:
  └── Epic 3: 수평 확장 (Nginx + 복제)   ← Epic 1 의존

Phase 3 Step 3:
  └── Epic 4: 모니터링 (Prometheus)       ← 최종 안정화
```

---

## Phase별 아키텍처 진화 요약

| 항목 | Phase 1 | Phase 2 | Phase 3 (목표) |
|------|---------|---------|----------------|
| 서버 | 단일 | 2서버 (chat+api) | **N서버 + LB** |
| 메시지 DB | MySQL | MongoDB | MongoDB |
| 브로커 | SimpleBroker | SimpleBroker | **RabbitMQ** |
| 인증 | HttpSession | JWT | JWT |
| 이미지 | Base64 (DB) | Base64 (DB) | **MinIO/S3** |
| 모니터링 | 없음 | 로그 | **Prometheus+Grafana** |
| 동시 접속 | ~400명 | ~1,000명 | **~3,000명+** |
| 방당 한계 | ~200명 | ~200명 | **~500명+** |

---

*본 로드맵은 Phase 2 부하 테스트 결과(`load-test-report.md`) 및 회고(`docs/phase2-retrospective.md`)를 기반으로 작성되었습니다.*
