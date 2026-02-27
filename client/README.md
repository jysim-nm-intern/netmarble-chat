# Netmarble Chat Client

React + Vite 기반의 실시간 채팅 클라이언트 애플리케이션입니다.

## 기술 스택

- **React 18.2**: UI 라이브러리
- **Vite 5**: 빌드 도구 및 개발 서버
- **Tailwind CSS 3**: 유틸리티 기반 CSS 프레임워크
- **SockJS Client**: WebSocket 폴백 지원
- **STOMP.js**: WebSocket 메시징 프로토콜
- **Axios**: HTTP 클라이언트

## 환경 설정

### 1. 의존성 설치

```bash
cd client
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

개발 서버는 `http://localhost:3000`에서 실행됩니다.

### 3. 프로덕션 빌드

```bash
npm run build
```

빌드된 파일은 `dist/` 디렉토리에 생성됩니다.

### 4. 프로덕션 미리보기

```bash
npm run preview
```

### 5. 테스트

유닛/컴포넌트 테스트:

```bash
npm run test
```

개발 중 감시 모드:

```bash
npm run test:watch
```

E2E 테스트 (프론트 + 백엔드 실행 필요):

```bash
npm run test:e2e
```

## 프로젝트 구조

```
client/
├── src/
│   ├── main.jsx          # 애플리케이션 엔트리 포인트
│   ├── App.jsx           # 루트 컴포넌트
│   └── index.css         # 글로벌 스타일
├── index.html            # HTML 템플릿
├── vite.config.js        # Vite 설정
├── tailwind.config.js    # Tailwind CSS 설정
└── package.json          # 프로젝트 의존성
```

## API 프록시 설정

`vite.config.js`에서 백엔드 API 프록시가 설정되어 있습니다:

- `/api` → `http://localhost:8080`
- `/ws` → `ws://localhost:8080` (WebSocket)

## 주요 기능 (예정)

- [ ] 닉네임 입력 및 로그인
- [ ] 채팅방 목록
- [ ] 실시간 메시지 송수신
- [ ] 스티커/이미지 전송
- [ ] 메시지 검색
- [ ] 읽음 처리

## 개발 가이드

### 코드 스타일

프로젝트는 ESLint를 사용합니다:

```bash
npm run lint
```

### 환경 변수

필요한 경우 `.env` 파일을 생성하여 환경 변수를 설정할 수 있습니다.
