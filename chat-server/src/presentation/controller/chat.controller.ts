import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Logger,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { MessageApplicationService } from '../../application/service/message-application.service.js';
import { ReadStatusApplicationService } from '../../application/service/read-status-application.service.js';
import { ChatRoomApplicationService } from '../../application/service/chat-room-application.service.js';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repository/user.repository.js';

@Controller('api/chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly messageService: MessageApplicationService,
    private readonly readStatusService: ReadStatusApplicationService,
    private readonly chatRoomService: ChatRoomApplicationService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  @Get('unread-count/:chatRoomId')
  async getUnreadCountMapping(
    @Param('chatRoomId', ParseIntPipe) chatRoomId: number,
  ): Promise<Record<string, number>> {
    const messages = await this.messageService.getChatRoomMessages(
      chatRoomId,
      null,
    );
    const mapping: Record<string, number> = {};
    for (const msg of messages) {
      if (msg.unreadCount && msg.unreadCount > 0 && msg.id) {
        mapping[String(msg.unreadCount)] = msg.id;
      }
    }
    return mapping;
  }

  @Post('update-status-and-logid')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateStatusAndLogId(
    @Body()
    request: {
      chatRoomId: number;
      nickname: string;
      isOnline: boolean;
      logId?: number;
    },
  ): Promise<void> {
    const user = await this.userRepository.findByNickname(request.nickname);
    if (!user) throw new Error('사용자를 찾을 수 없습니다: ' + request.nickname);

    await this.chatRoomService.updateMemberActiveStatus(
      request.chatRoomId,
      user.id!,
      request.isOnline,
    );

    if (!request.isOnline && request.logId) {
      await this.readStatusService.markAsRead(user.id!, request.chatRoomId);
    }
  }

  @Post('update-read-status')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateReadStatus(
    @Body() request: { chatRoomId: number; nickname: string },
  ): Promise<void> {
    const user = await this.userRepository.findByNickname(request.nickname);
    if (!user) throw new Error('사용자를 찾을 수 없습니다: ' + request.nickname);
    await this.readStatusService.markAsRead(user.id!, request.chatRoomId);
  }

  @Get('chat-rooms/:chatRoomId/messages/search')
  async searchMessages(
    @Param('chatRoomId', ParseIntPipe) chatRoomId: number,
    @Query('keyword') keyword: string,
  ) {
    return this.messageService.searchMessages(chatRoomId, keyword);
  }
}
