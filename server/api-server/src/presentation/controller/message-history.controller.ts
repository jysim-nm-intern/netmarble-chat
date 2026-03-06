import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import {
  MessageQueryService,
  Direction,
} from '../../application/service/message-query.service.js';
import { MessageResponse } from '../../application/dto/message-response.dto.js';
import { CursorPageResponse } from '../../application/dto/cursor-page-response.dto.js';

/**
 * 메시지 이력 조회 REST 컨트롤러 (api-server 전담)
 *
 * GET /api/rooms/{roomId}/messages
 *   ?cursor={objectId}  -- 마지막으로 본 메시지 ID (없으면 최신부터)
 *   &limit={n}          -- 요청 건수 (기본 50, 최대 100)
 *   &direction=BEFORE   -- BEFORE(이전 메시지) | AFTER(이후 메시지)
 */
@Controller('api/rooms')
export class MessageHistoryController {
  private readonly logger = new Logger(MessageHistoryController.name);

  constructor(private readonly messageQueryService: MessageQueryService) {}

  @Get(':roomId/messages')
  async getMessages(
    @Param('roomId') roomId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitStr?: string,
    @Query('direction') directionStr?: string,
  ): Promise<CursorPageResponse<MessageResponse>> {
    const limit = limitStr ? parseInt(limitStr, 10) || 50 : 50;
    const direction =
      directionStr?.toUpperCase() === 'AFTER'
        ? Direction.AFTER
        : Direction.BEFORE;

    this.logger.log(
      `GET /api/rooms/${roomId}/messages cursor=${cursor}, limit=${limit}, dir=${direction}`,
    );

    return this.messageQueryService.findByCursor(
      roomId,
      cursor,
      limit,
      direction,
    );
  }
}
