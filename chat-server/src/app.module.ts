import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Infrastructure - Entities
import { UserEntity } from './infrastructure/persistence/entity/user.entity.js';
import { ChatRoomEntity } from './infrastructure/persistence/entity/chat-room.entity.js';
import { ChatRoomMemberEntity } from './infrastructure/persistence/entity/chat-room-member.entity.js';
import { MessageEntity } from './infrastructure/persistence/entity/message.entity.js';
import { AttachmentEntity } from './infrastructure/persistence/entity/attachment.entity.js';

// Infrastructure - Repositories
import { TypeormUserRepository } from './infrastructure/persistence/repository/typeorm-user.repository.js';
import { TypeormChatRoomRepository } from './infrastructure/persistence/repository/typeorm-chat-room.repository.js';
import { TypeormChatRoomMemberRepository } from './infrastructure/persistence/repository/typeorm-chat-room-member.repository.js';
import { TypeormMessageRepository } from './infrastructure/persistence/repository/typeorm-message.repository.js';
import { TypeormAttachmentRepository } from './infrastructure/persistence/repository/typeorm-attachment.repository.js';

// Infrastructure - Config
import { StompBrokerService } from './infrastructure/config/stomp-broker.service.js';

// Domain - Repository Tokens
import { USER_REPOSITORY } from './domain/repository/user.repository.js';
import { CHAT_ROOM_REPOSITORY } from './domain/repository/chat-room.repository.js';
import { CHAT_ROOM_MEMBER_REPOSITORY } from './domain/repository/chat-room-member.repository.js';
import { MESSAGE_REPOSITORY } from './domain/repository/message.repository.js';
import { ATTACHMENT_REPOSITORY } from './domain/repository/attachment.repository.js';

// Domain - Services
import { UserDomainService } from './domain/service/user-domain.service.js';

// Application - Services
import { UserApplicationService } from './application/service/user-application.service.js';
import { ChatRoomApplicationService } from './application/service/chat-room-application.service.js';
import { MessageApplicationService } from './application/service/message-application.service.js';
import { ReadStatusApplicationService } from './application/service/read-status-application.service.js';

// Presentation - Controllers
import { HealthController } from './presentation/controller/health.controller.js';
import { UserController } from './presentation/controller/user.controller.js';
import { ChatRoomController } from './presentation/controller/chat-room.controller.js';
import { ChatController } from './presentation/controller/chat.controller.js';
import { MessageController } from './presentation/controller/message.controller.js';
import { ReadStatusController } from './presentation/controller/read-status.controller.js';

// Presentation - Gateway
import { WebSocketMessageGateway } from './presentation/gateway/websocket-message.gateway.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USERNAME', 'chatuser'),
        password: config.get<string>('DB_PASSWORD', 'chatpass'),
        database: config.get<string>('DB_NAME', 'chatdb'),
        entities: [
          UserEntity,
          ChatRoomEntity,
          ChatRoomMemberEntity,
          MessageEntity,
          AttachmentEntity,
        ],
        synchronize: false,
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    TypeOrmModule.forFeature([
      UserEntity,
      ChatRoomEntity,
      ChatRoomMemberEntity,
      MessageEntity,
      AttachmentEntity,
    ]),
  ],
  controllers: [
    HealthController,
    UserController,
    ChatRoomController,
    ChatController,
    MessageController,
    ReadStatusController,
  ],
  providers: [
    // Infrastructure
    StompBrokerService,

    // Domain Services
    UserDomainService,

    // Application Services
    UserApplicationService,
    ChatRoomApplicationService,
    MessageApplicationService,
    ReadStatusApplicationService,

    // WebSocket Gateway
    WebSocketMessageGateway,

    // Repository bindings (Symbol → Implementation)
    {
      provide: USER_REPOSITORY,
      useClass: TypeormUserRepository,
    },
    {
      provide: CHAT_ROOM_REPOSITORY,
      useClass: TypeormChatRoomRepository,
    },
    {
      provide: CHAT_ROOM_MEMBER_REPOSITORY,
      useClass: TypeormChatRoomMemberRepository,
    },
    {
      provide: MESSAGE_REPOSITORY,
      useClass: TypeormMessageRepository,
    },
    {
      provide: ATTACHMENT_REPOSITORY,
      useClass: TypeormAttachmentRepository,
    },
  ],
})
export class AppModule {}
