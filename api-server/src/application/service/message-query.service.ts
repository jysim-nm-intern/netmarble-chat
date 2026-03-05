import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { MessageMongoRepository } from '../../infrastructure/mongo/repository/message-mongo.repository.js';
import { MessageResponse } from '../dto/message-response.dto.js';
import { CursorPageResponse } from '../dto/cursor-page-response.dto.js';
import { MessageDocumentType } from '../../infrastructure/mongo/document/message.document.js';

export enum Direction {
  BEFORE = 'BEFORE',
  AFTER = 'AFTER',
}

const MAX_LIMIT = 100;

/**
 * Cursor-based 메시지 이력 조회 서비스
 *
 * GET /api/rooms/{roomId}/messages?cursor={id}&limit=50&direction=BEFORE
 *
 * MongoDB 쿼리: { roomId, _id: { $lt: cursor } }.sort({ _id: -1 }).limit(n)
 * ObjectId 자체가 시간 순서를 포함하므로 별도 createdAt 정렬 인덱스 불필요.
 */
@Injectable()
export class MessageQueryService {
  private readonly logger = new Logger(MessageQueryService.name);

  constructor(
    private readonly messageMongoRepository: MessageMongoRepository,
  ) {}

  async findByCursor(
    roomId: string,
    cursor: string | undefined,
    limit: number,
    direction: Direction,
  ): Promise<CursorPageResponse<MessageResponse>> {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    this.logger.debug(
      `[MessageQuery] roomId=${roomId}, cursor=${cursor}, limit=${safeLimit}, direction=${direction}`,
    );

    let docs: MessageDocumentType[];

    if (!cursor) {
      // cursor 없음 -> 최신 메시지부터
      docs = await this.messageMongoRepository.findByRoomIdLatest(
        roomId,
        safeLimit,
      );
    } else {
      const cursorId = new Types.ObjectId(cursor);
      if (direction === Direction.BEFORE) {
        docs = await this.messageMongoRepository.findByRoomIdBeforeCursor(
          roomId,
          cursorId,
          safeLimit,
        );
      } else {
        docs = await this.messageMongoRepository.findByRoomIdAfterCursor(
          roomId,
          cursorId,
          safeLimit,
        );
      }
    }

    if (docs.length === 0) {
      return CursorPageResponse.empty();
    }

    const responses = docs.map((doc) => this.toResponse(doc));

    // 마지막 도큐먼트 ID가 nextCursor
    const nextCursor = docs[docs.length - 1]._id.toString();

    // 다음 페이지 존재 여부 확인
    const hasMore =
      direction !== Direction.AFTER &&
      (await this.messageMongoRepository.existsByRoomIdBeforeCursor(
        roomId,
        new Types.ObjectId(nextCursor),
      ));

    return CursorPageResponse.of(responses, nextCursor, hasMore);
  }

  private toResponse(doc: MessageDocumentType): MessageResponse {
    const senderNickname = doc.senderNickname ?? 'System';
    const senderId = doc.senderId ? parseInt(doc.senderId, 10) || null : null;
    const chatRoomId = doc.roomId ? parseInt(doc.roomId, 10) || null : null;

    return new MessageResponse({
      id: null,
      chatRoomId,
      senderId,
      senderNickname,
      content: doc.content,
      type: doc.type,
      sentAt: doc.createdAt,
      deleted: false,
    });
  }
}
