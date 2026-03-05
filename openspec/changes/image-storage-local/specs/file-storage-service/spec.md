## ADDED Requirements

### Requirement: 이미지 파일 저장
시스템은 업로드된 이미지 파일을 로컬 파일 시스템(`/data/uploads/{type}/{yyyy/MM/dd}/`)에 UUID v4 기반 파일명으로 저장하고, 접근 가능한 URL 경로를 반환해야 한다(SHALL).

#### Scenario: 이미지 파일 저장 성공
- **WHEN** `MultipartFile`(JPG, 3MB)과 type `messages`로 `FileStorageService.store()`를 호출한다
- **THEN** 파일이 `/data/uploads/messages/{yyyy/MM/dd}/{uuid}.jpg` 경로에 저장되고, `/uploads/messages/{yyyy/MM/dd}/{uuid}.jpg` 형식의 URL 문자열이 반환된다

#### Scenario: 프로필 이미지 저장
- **WHEN** `MultipartFile`(PNG, 1MB)과 type `profiles`로 `FileStorageService.store()`를 호출한다
- **THEN** 파일이 `/data/uploads/profiles/{yyyy/MM/dd}/{uuid}.png` 경로에 저장되고, `/uploads/profiles/{yyyy/MM/dd}/{uuid}.png` 형식의 URL이 반환된다

#### Scenario: 채팅방 썸네일 저장
- **WHEN** `MultipartFile`(GIF, 2MB)과 type `rooms`로 `FileStorageService.store()`를 호출한다
- **THEN** 파일이 `/data/uploads/rooms/{yyyy/MM/dd}/{uuid}.gif` 경로에 저장되고, `/uploads/rooms/{yyyy/MM/dd}/{uuid}.gif` 형식의 URL이 반환된다

### Requirement: 저장 디렉토리 자동 생성
저장 대상 디렉토리가 존재하지 않는 경우 시스템이 자동으로 생성해야 한다(SHALL).

#### Scenario: 디렉토리 미존재 시 자동 생성
- **WHEN** `/data/uploads/messages/2026/03/04/` 디렉토리가 존재하지 않는 상태에서 파일 저장을 요청한다
- **THEN** 해당 디렉토리가 자동 생성되고 파일이 정상 저장된다

### Requirement: 파일 확장자 검증
시스템은 JPG, JPEG, PNG, GIF 확장자만 허용하고, 그 외 확장자는 거부해야 한다(SHALL).

#### Scenario: 허용되지 않는 확장자 업로드
- **WHEN** `.bmp` 확장자 파일로 `FileStorageService.store()`를 호출한다
- **THEN** `InvalidFileException`이 발생하고 파일이 저장되지 않는다

### Requirement: 파일 크기 제한
시스템은 5MB를 초과하는 파일의 저장을 거부해야 한다(SHALL).

#### Scenario: 5MB 초과 파일 저장 시도
- **WHEN** 6MB 크기의 PNG 파일로 `FileStorageService.store()`를 호출한다
- **THEN** `FileSizeLimitExceededException`이 발생하고 파일이 저장되지 않는다

### Requirement: 파일 삭제
시스템은 저장된 파일을 경로 기반으로 삭제할 수 있어야 한다(SHALL).

#### Scenario: 파일 삭제 성공
- **WHEN** 존재하는 파일 경로로 `FileStorageService.delete()`를 호출한다
- **THEN** 해당 파일이 디스크에서 삭제된다

#### Scenario: 존재하지 않는 파일 삭제 시도
- **WHEN** 존재하지 않는 파일 경로로 `FileStorageService.delete()`를 호출한다
- **THEN** 예외 없이 정상 완료된다 (멱등성)

### Requirement: DDD 인터페이스 기반 설계
`FileStorageService`는 인터페이스로 정의하고, `LocalFileStorageService`가 구현해야 한다(SHALL). 도메인 계층은 구현체에 의존하지 않는다.

#### Scenario: 인터페이스 의존성
- **WHEN** `MessageApplicationService`가 파일 저장 기능을 사용한다
- **THEN** `FileStorageService` 인터페이스에만 의존하고, `LocalFileStorageService`에 직접 의존하지 않는다
