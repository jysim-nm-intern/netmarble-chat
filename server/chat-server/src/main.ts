import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './presentation/filter/global-exception.filter.js';
import { StompBrokerService } from './infrastructure/config/stomp-broker.service.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // body-parser strict: false — 클라이언트가 POST body로 null을 보내는 경우 허용
  app.use(json({ strict: false }));
  app.use(urlencoded({ extended: true }));

  // CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 글로벌 파이프 & 필터
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT ?? 8080;
  await app.listen(port);

  // SockJS 핸들러를 NestJS HTTP 서버에 설치 (WS_PORT=0인 통합 모드)
  const wsPort = parseInt(process.env.WS_PORT ?? '0', 10);
  if (wsPort === 0) {
    const stompBroker = app.get(StompBrokerService);
    stompBroker.installHandlers(app.getHttpServer());
  }

  logger.log(`chat-server 시작: port=${port}`);
}
bootstrap();
