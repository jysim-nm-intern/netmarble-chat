import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ReadStatusDocument,
  ReadStatusDocumentType,
} from '../document/read-status.document.js';

/**
 * 읽음 상태 MongoDB 레포지토리 (대규모 방 전용)
 */
@Injectable()
export class ReadStatusMongoRepository {
  constructor(
    @InjectModel(ReadStatusDocument.name)
    private readonly readStatusModel: Model<ReadStatusDocumentType>,
  ) {}

  async existsByMessageIdAndUserId(
    messageId: string,
    userId: string,
  ): Promise<boolean> {
    const doc = await this.readStatusModel
      .findOne({ messageId, userId })
      .select('_id')
      .lean()
      .exec();
    return doc !== null;
  }

  async countByMessageId(messageId: string): Promise<number> {
    return this.readStatusModel.countDocuments({ messageId }).exec();
  }
}
