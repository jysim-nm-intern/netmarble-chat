import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { MessageApplicationService } from '../../application/service/message-application.service.js';
import { MessageResponse } from '../../application/dto/index.js';

@Controller('api/messages')
export class MessageController {
  private readonly logger = new Logger(MessageController.name);

  constructor(
    private readonly messageService: MessageApplicationService,
  ) {}

  @Get('chatroom/:chatRoomId')
  async getChatRoomMessages(
    @Param('chatRoomId', ParseIntPipe) chatRoomId: number,
    @Query('userId') userIdStr?: string,
  ): Promise<MessageResponse[]> {
    const userId = userIdStr ? parseInt(userIdStr, 10) : null;
    return this.messageService.getChatRoomMessages(chatRoomId, userId);
  }

  @Get(':id')
  async getMessageById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MessageResponse> {
    return this.messageService.getMessageById(id);
  }

  @Delete(':id')
  async deleteMessage(
    @Param('id', ParseIntPipe) id: number,
    @Query('userId') userIdStr: string,
  ): Promise<void> {
    await this.messageService.deleteMessage(id, parseInt(userIdStr, 10));
  }
}
