# 07. 비기능 명세 (Non-Functional Specifications)

← [목차로 돌아가기](../sdd-specification.md)

---

## SPEC-NFR-001: 실시간 응답성

| 항목 | 기준 |
|------|------|
| 메시지 전달 지연 | 텍스트 메시지 전송 후 **200ms 이내**에 같은 채팅방 사용자에게 전달 (로컬 환경 기준) |
| WebSocket 재연결 | 연결 해제 시 **SockJS Fallback**을 통해 자동 재연결 시도 |
| 읽음 카운트 갱신 | 읽음 처리 이벤트 수신 즉시 UI에 반영 |

---

## SPEC-NFR-002: 사용성 (UX)

| 항목 | 요구사항 |
|------|---------|
| 로딩 상태 | 모든 비동기 요청(REST, 파일 업로드)에서 로딩 인디케이터를 표시한다. |
| 오류 메시지 | 서버 오류 발생 시 사용자가 이해할 수 있는 친화적 메시지를 표시한다. (기술적 에러 코드 노출 금지) |
| 재시도 수단 | 네트워크 오류로 인한 로딩 실패 시 재시도(Retry) 버튼을 제공한다. |
| 자동 스크롤 | 새 메시지 수신 시 채팅 목록이 자동으로 최하단으로 스크롤된다. |
| WebSocket 상태 표시 | 연결 중 / 연결됨 / 연결 끊김 상태를 채팅창 UI에 표시한다. |
| 메시지 정렬 | 내가 보낸 메시지는 우측, 상대 메시지는 좌측에 표시된다. |

---

## SPEC-NFR-003: 확장성 설계

### 메시징 브로커 교체 가능성

```
현재 구현: Spring SimpleBroker (단일 서버)
향후 전환: Apache Kafka 또는 RabbitMQ (다중 서버)
교체 방법: MessageSender 인터페이스의 구현체만 교체 (도메인 코드 수정 없음)
```

### 데이터베이스 교체 가능성

```
현재 구현: MySQL (JPA/Hibernate)
향후 전환: MongoDB (대용량 메시지 저장)
교체 방법: Repository 인터페이스의 구현체만 교체 (도메인 코드 수정 없음)
```

### 다중 클라이언트 지원

- 포트 3000, 3001 등 여러 포트에서 동시에 클라이언트를 실행하여 다중 사용자 환경을 시뮬레이션한다.
- CORS 설정으로 로컬 멀티포트 접근을 허용한다.

---

## SPEC-NFR-004: 코드 품질

| 항목 | 기준 |
|------|------|
| 테스트 우선순위 | 핵심 비즈니스 로직(Domain, Application Service) 구현 시 단위 테스트를 함께 작성한다. |
| 오류 응답 일관성 | 모든 예외는 `GlobalExceptionHandler`에서 공통 형식으로 처리한다. |
| 코드 언어 | 주석, 로그, 시스템 메시지는 한국어로 작성한다. |
| 의존성 주입 | 필드 주입(`@Autowired`) 금지, 생성자 주입(`@RequiredArgsConstructor`) 사용. |
| 계층 격리 | Controller → Repository 직접 호출 금지. Service 계층을 반드시 거친다. |

---

## SPEC-NFR-005: 테스트 커버리지 (JaCoCo)

> 핵심 비즈니스 로직은 구현과 동시에 단위 테스트를 작성하여 아래 커버리지 기준을 충족해야 한다.
> 커버리지는 JaCoCo로 측정하며, `./gradlew test jacocoTestReport` 명령으로 생성한다.

### 커버리지 목표

| 패키지 (계층) | 측정 기준 | 목표 | 설명 |
|-------------|---------|------|------|
| `domain.model` | Line | **80% 이상** | 엔티티 도메인 로직 (생성, 상태 변경, 유효성 검증) |
| `domain.service` | Line | **90% 이상** | 도메인 서비스 핵심 비즈니스 규칙 |
| `application.service` | Line | **70% 이상** | 유즈케이스 조율 로직 |
| `presentation.controller` | Line | **50% 이상** | 컨트롤러 엔드포인트 |
| **전체 (BUNDLE)** | Line | **60% 이상** | 전체 가중 합산 |

### 커버리지 측정 제외 대상

비즈니스 로직이 없는 기계적 코드는 측정 대상에서 제외한다.

| 제외 패턴 | 이유 |
|----------|------|
| `**/dto/**` | 데이터 전달 객체 (로직 없음) |
| `**/config/**` | 인프라 설정 클래스 |
| `**/ChatApplication*` | 애플리케이션 진입점 |
| `**/exception/ErrorResponse*` | 단순 오류 응답 구조체 |
| `**/domain/repository/**` | 인터페이스 (구현체 없음) |
| `**/infrastructure/persistence/Jpa*` | Spring Data 자동 구현체 |

### 테스트 실행 명령

```bash
# 단위 테스트 + 커버리지 보고서 생성 (MySQL 불필요)
cd server && ./gradlew test jacocoTestReport

# 커버리지 최소 기준 검증 (빌드 실패 여부 확인)
cd server && ./gradlew jacocoTestCoverageVerification

# 통합 테스트 별도 실행 (로컬 MySQL localhost:3306 필요)
cd server && ./gradlew integrationTest
```

### 보고서 위치

```
server/build/reports/jacoco/test/html/index.html       ← HTML (브라우저 확인)
server/build/reports/jacoco/test/jacocoTestReport.xml  ← XML (CI 연동용)
```

### 테스트 태그 정책

| 태그 | 대상 테스트 유형 | 실행 조건 |
|-----|--------------|---------|
| (태그 없음) | 단위 테스트, `@WebMvcTest` | 항상 실행 (외부 인프라 불필요) |
| `@Tag("integration")` | `@SpringBootTest` + 실제 DB | MySQL 실행 중일 때만 실행 |

---

## SPEC-NFR-006: 보안

| 항목 | 요구사항 |
|------|---------|
| Entity 노출 금지 | API 응답에 JPA Entity를 직접 반환하지 않는다. 반드시 DTO로 변환한다. |
| 파일 업로드 검증 | 클라이언트 검증과 별개로 서버에서 파일 형식(JPG/PNG/GIF)과 크기(5MB)를 재검증한다. |
| SQL Injection 방지 | JPA Query Method 또는 `@Query` 파라미터 바인딩만 사용한다. Native Query에서 문자열 직접 연결 금지. |
| XSS 방지 | 메시지 내용을 프론트엔드에서 렌더링 시 HTML 이스케이프 처리한다. (`innerHTML` 직접 사용 금지) |
