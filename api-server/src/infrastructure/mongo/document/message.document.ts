import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessageDocumentType = HydratedDocument<MessageDocument>;

/**
 * MongoDB 메시지 도큐먼트 (비정규화 모델)
 *
 * 인덱스:
 *   - { roomId: 1, _id: -1 }  -> Cursor-based 페이지네이션 핵심
 *   - { senderId: 1, createdAt: -1 } -> 발신자별 메시지 이력
 */
@Schema({
  collection: 'messages',
  timestamps: { createdAt: 'createdAt', updatedAt: false },
})
export class MessageDocument {
  _id!: string;

  @Prop({ required: true, index: true })
  roomId!: string;

  @Prop()
  senderId?: string;

  /** 비정규화: User JOIN 제거를 위해 발신 시점 닉네임 저장 */
  @Prop()
  senderNickname?: string;

  @Prop()
  content?: string;

  @Prop({ default: 'TEXT' })
  type!: string;

  /** 읽음 카운트 (Redis와 주기적 동기화) */
  @Prop({ default: 0 })
  readCount!: number;

  @Prop()
  createdAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(MessageDocument);

// 복합 인덱스
MessageSchema.index({ roomId: 1, _id: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });
