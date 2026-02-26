# 01. 프로젝트 개요

← [목차로 돌아가기](../sdd-specification.md)

---

## 목적

닉네임 기반 인증, 실시간 메시지 송수신, 다중 채팅방, 스티커/이미지 전송, 메시지 검색, 읽음 처리 기능을 갖춘 **실시간 멀티 채팅 웹 서비스**를 구축한다.

## 범위

| 영역 | 포함 범위 |
|------|-----------|
| **프론트엔드** | React 기반 SPA (닉네임 로그인 → 채팅방 목록 → 채팅방 뷰) |
| **백엔드** | Spring Boot REST API + STOMP WebSocket 서버 |
| **데이터베이스** | MySQL (Docker 컨테이너) |
| **제외 범위** | 실 서버 배포, 인증/인가(JWT), 외부 파일 스토리지 서비스 |

## 요구사항

### 필수 요구사항

| ID | 요구사항 | 관련 SPEC |
|----|---------|-----------|
| REQ-01 | 채팅 사이트 접속 시 닉네임 입력 | [SPEC-USR-001](03-functional-specs.md#spec-usr-001-닉네임-기반-로그인) |
| REQ-02 | 실시간 메시지 송/수신 | [SPEC-MSG-001](03-functional-specs.md#spec-msg-001-텍스트-메시지-전송) |
| REQ-03 | 복수 채팅방 생성 및 활용 | [SPEC-ROOM-001~002](03-functional-specs.md#spec-room-채팅방-관리) |
| REQ-04 | 복수 인원 동시 채팅 | [SPEC-MSG-001](03-functional-specs.md#spec-msg-001-텍스트-메시지-전송) |
| REQ-05 | 스티커/이미지 전송 | [SPEC-MSG-002~003](03-functional-specs.md#spec-msg-002-이미지-전송) |
| REQ-06 | 채팅방 나가기 기능 | [SPEC-ROOM-004](03-functional-specs.md#spec-room-004-채팅방-퇴장) |
| REQ-07 | 채팅 메시지 검색 | [SPEC-MSG-005](03-functional-specs.md#spec-msg-005-메시지-검색) |
| REQ-08 | 메시지 읽음 처리 (미읽음 카운트) | [SPEC-READ-001](03-functional-specs.md#spec-read-001-메시지-읽음-처리-워터마크-갱신) |

## 기술 스택

| 계층 | 기술 | 버전 |
|------|------|------|
| 프론트엔드 | React + Vite | 18.x |
| 상태 관리 | Zustand | - |
| 스타일링 | TailwindCSS | - |
| REST 클라이언트 | Axios | - |
| WebSocket 클라이언트 | @stomp/stompjs + SockJS | - |
| 백엔드 | Spring Boot | 3.x |
| ORM | Spring Data JPA (Hibernate) | - |
| 데이터베이스 | MySQL | 8.x (Docker) |
| 빌드 도구 | Maven (서버), Vite (클라이언트) | - |
| 테스트 (BE) | JUnit 5, Mockito, Testcontainers | - |
| 테스트 (FE) | Vitest, React Testing Library, Playwright | - |
| AI 도구 | GitHub Copilot / Claude | - |

## 구동 환경

- **OS:** Windows 11 로컬 환경
- **필수 설치:** Docker, Node.js 18+, Java 17+, Maven 3.8+

| 서비스 | URL | 설명 |
|--------|-----|------|
| 클라이언트 1 | http://localhost:3000 | 첫 번째 사용자 |
| 클라이언트 2 | http://localhost:3001 | 두 번째 사용자 (테스트용) |
| 서버 API | http://localhost:8080 | 백엔드 API |
| MySQL | localhost:3307 | 데이터베이스 (Docker) |
