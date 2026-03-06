import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MessageDocument,
  MessageDocumentType,
} from '../document/message.document.js';

/**
 * MongoDB 메시지 레포지토리
 *
 * Cursor-based 페이지네이션 핵심 쿼리:
 *   { roomId, _id: { $lt: cursor } }.sort({ _id: -1 }).limit(n)
 */
@Injectable()
export class MessageMongoRepository {
  constructor(
    @InjectModel(MessageDocument.name)
    private readonly messageModel: Model<MessageDocumentType>,
  ) {}

  /** cursor 없이 최신 메시지 N건 조회 (초기 로드) */
  async findByRoomIdLatest(
    roomId: string,
    limit: number,
  ): Promise<MessageDocumentType[]> {
    return this.messageModel
      .find({ roomId } as any)
      .sort({ _id: -1 })
      .limit(limit)
      .exec();
  }

  /** cursor 이전 메시지 조회 (BEFORE 방향 -- 무한 스크롤) */
  async findByRoomIdBeforeCursor(
    roomId: string,
    cursorId: Types.ObjectId,
    limit: number,
  ): Promise<MessageDocumentType[]> {
    return this.messageModel
      .find({ roomId, _id: { $lt: cursorId } } as any)
      .sort({ _id: -1 })
      .limit(limit)
      .exec();
  }

  /** cursor 이후 메시지 조회 (AFTER 방향 -- 실시간 보완) */
  async findByRoomIdAfterCursor(
    roomId: string,
    cursorId: Types.ObjectId,
    limit: number,
  ): Promise<MessageDocumentType[]> {
    return this.messageModel
      .find({ roomId, _id: { $gt: cursorId } } as any)
      .sort({ _id: 1 })
      .limit(limit)
      .exec();
  }

  /** 특정 메시지 이전에 더 있는지 확인 (hasMore 계산용) */
  async existsByRoomIdBeforeCursor(
    roomId: string,
    cursorId: Types.ObjectId,
  ): Promise<boolean> {
    const doc = await this.messageModel
      .findOne({ roomId, _id: { $lt: cursorId } } as any)
      .select('_id')
      .lean()
      .exec();
    return doc !== null;
  }
}
