import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ReadStatusDocumentType = HydratedDocument<ReadStatusDocument>;

/**
 * 읽음 상태 도큐먼트 -- 대규모 방(500명 초과) 전용
 *
 * 500명 이하: Redis 카운트 관리
 * 500명 초과: 이 컬렉션에 상세 기록 저장
 *
 * 인덱스: { messageId: 1, userId: 1 } UNIQUE -> 중복 읽음 방지
 */
@Schema({ collection: 'read_status' })
export class ReadStatusDocument {
  @Prop({ required: true })
  messageId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ default: () => new Date() })
  readAt!: Date;
}

export const ReadStatusSchema =
  SchemaFactory.createForClass(ReadStatusDocument);

ReadStatusSchema.index({ messageId: 1, userId: 1 }, { unique: true });
