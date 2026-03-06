import { User } from './user.js';

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  STICKER = 'STICKER',
  SYSTEM = 'SYSTEM',
}

/**
 * Message 도메인 모델
 */
export class Message {
  id?: number;
  chatRoomId!: number;
  sender: User | null;
  content: string;
  type: MessageType;
  sentAt: Date;
  deleted: boolean;

  constructor(
    chatRoomId: number,
    sender: User | null,
    content: string,
    type: MessageType = MessageType.TEXT,
  ) {
    this.validateContent(content, type);
    this.chatRoomId = chatRoomId;
    this.sender = sender;
    this.content = content;
    this.type = type;
    this.sentAt = new Date();
    this.deleted = false;
  }

  private validateContent(content: string, type: MessageType): void {
    if (!content || !content.trim()) {
      throw new Error('메시지 내용은 비어있을 수 없습니다.');
    }
    if (type === MessageType.TEXT && content.length > 5000) {
      throw new Error('메시지는 5000자를 초과할 수 없습니다.');
    }
  }

  delete(): void {
    this.deleted = true;
  }

  static createSystemMessage(chatRoomId: number, content: string): Message {
    const msg = new Message(chatRoomId, null, content, MessageType.SYSTEM);
    return msg;
  }
}
