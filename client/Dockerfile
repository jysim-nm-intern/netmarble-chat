FROM node:18-alpine

WORKDIR /app

# 의존성 먼저 복사 (소스 변경 시 npm install 재실행 방지)
COPY package*.json ./
RUN npm ci

# 소스 복사
COPY . .

EXPOSE 3000

# VITE_PORT 환경변수로 포트 설정 (기본값 3000)
# --host 0.0.0.0: Docker 컨테이너 외부에서 접근 허용
CMD ["sh", "-c", "npm run dev -- --host 0.0.0.0 --port ${VITE_PORT:-3000}"]
