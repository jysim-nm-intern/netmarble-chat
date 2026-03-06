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
import { MessageApplicationService } from '../../application/service/message-application.service.js';
import { ReadStatusApplicationService } from '../../application/service/read-status-application.service.js';
import { ChatRoomApplicationService } from '../../application/service/chat-room-application.service.js';
import { UserApplicationService } from '../../application/service/user-application.service.js';

@Controller('api/chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly messageService: MessageApplicationService,
    private readonly readStatusService: ReadStatusApplicationService,
    private readonly chatRoomService: ChatRoomApplicationService,
    private readonly userApplicationService: UserApplicationService,
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
      if (msg.unreadCount !== undefined && msg.unreadCount > 0 && msg.id) {
        mapping[String(msg.id)] = msg.unreadCount;
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
    const userResponse = await this.userApplicationService.getUserByNickname(request.nickname);

    await this.chatRoomService.updateMemberActiveStatus(
      request.chatRoomId,
      userResponse.id,
      request.isOnline,
    );

    if (!request.isOnline && request.logId !== undefined) {
      await this.readStatusService.markAsRead(userResponse.id, request.chatRoomId);
    }
  }

  @Post('update-read-status')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateReadStatus(
    @Body() request: { chatRoomId: number; nickname: string },
  ): Promise<void> {
    const userResponse = await this.userApplicationService.getUserByNickname(request.nickname);
    await this.readStatusService.markAsRead(userResponse.id, request.chatRoomId);
  }

  @Get('chat-rooms/:chatRoomId/messages/search')
  async searchMessages(
    @Param('chatRoomId', ParseIntPipe) chatRoomId: number,
    @Query('keyword') keyword: string,
  ) {
    return this.messageService.searchMessages(chatRoomId, keyword);
  }
}
