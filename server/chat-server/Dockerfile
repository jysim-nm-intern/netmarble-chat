# ── Stage 1: Build ──
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ src/

RUN npm run build

# ── Stage 2: Production ──
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/ dist/

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
