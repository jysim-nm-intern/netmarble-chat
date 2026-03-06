import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageDocument, MessageSchema } from './infrastructure/mongo/document/message.document.js';
import {
  ReadStatusDocument,
  ReadStatusSchema,
} from './infrastructure/mongo/document/read-status.document.js';
import { MessageMongoRepository } from './infrastructure/mongo/repository/message-mongo.repository.js';
import { ReadStatusMongoRepository } from './infrastructure/mongo/repository/read-status-mongo.repository.js';
import { MessageQueryService } from './application/service/message-query.service.js';
import { MessageHistoryController } from './presentation/controller/message-history.controller.js';
import { HealthController } from './presentation/controller/health.controller.js';
import { GlobalExceptionFilter } from './presentation/filter/global-exception.filter.js';
import { APP_FILTER } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>(
          'MONGODB_URI',
          'mongodb://localhost:27017/netmarble_chat',
        ),
      }),
    }),
    MongooseModule.forFeature([
      { name: MessageDocument.name, schema: MessageSchema },
      { name: ReadStatusDocument.name, schema: ReadStatusSchema },
    ]),
  ],
  controllers: [HealthController, MessageHistoryController],
  providers: [
    MessageMongoRepository,
    ReadStatusMongoRepository,
    MessageQueryService,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
