import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ReadStatusApplicationService } from '../../application/service/read-status-application.service.js';
import { UnreadCountResponse } from '../../application/dto/index.js';

@Controller('api/read-status')
export class ReadStatusController {
  private readonly logger = new Logger(ReadStatusController.name);

  constructor(
    private readonly readStatusService: ReadStatusApplicationService,
  ) {}

  @Post('mark-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAsRead(
    @Query('userId') userIdStr: string,
    @Query('chatRoomId') chatRoomIdStr: string,
  ): Promise<void> {
    await this.readStatusService.markAsRead(
      parseInt(userIdStr, 10),
      parseInt(chatRoomIdStr, 10),
    );
  }

  @Get('unread-count')
  async getUnreadCount(
    @Query('userId') userIdStr: string,
    @Query('chatRoomId') chatRoomIdStr: string,
  ): Promise<number> {
    return this.readStatusService.getUnreadCount(
      parseInt(userIdStr, 10),
      parseInt(chatRoomIdStr, 10),
    );
  }

  @Get('unread-counts/:userId')
  async getAllUnreadCounts(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<Record<string, number>> {
    const counts = await this.readStatusService.getAllUnreadCounts(userId);
    const result: Record<string, number> = {};
    for (const [key, val] of counts) {
      result[String(key)] = val;
    }
    return result;
  }

  @Get('unread-counts-list/:userId')
  async getUnreadCountsList(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<UnreadCountResponse[]> {
    return this.readStatusService.getUnreadCountsForActiveChatRooms(userId);
  }
}
