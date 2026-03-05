import { MessageType } from '../../domain/model/message.js';

export class SendMessageRequest {
  chatRoomId!: number;
  senderId!: number;
  content!: string;
  messageType?: string;
  type: MessageType = MessageType.TEXT;
  fileName?: string;

  convertMessageType(): void {
    if (this.messageType) {
      const upper = this.messageType.toUpperCase();
      if (Object.values(MessageType).includes(upper as MessageType)) {
        this.type = upper as MessageType;
      } else {
        this.type = MessageType.TEXT;
      }
    }
  }

  validateByMessageType(): void {
    this.convertMessageType();
    if (!this.content || !this.content.trim()) {
      throw new Error('메시지 내용은 비어있을 수 없습니다.');
    }
    if (this.type === MessageType.TEXT && this.content.length > 5000) {
      throw new Error('텍스트 메시지는 5000자를 초과할 수 없습니다.');
    }
    if (this.type === MessageType.IMAGE) {
      if (this.content.length > 10485760) {
        throw new Error('이미지는 약 7.5MB를 초과할 수 없습니다.');
      }
      if (!this.fileName || !this.fileName.trim()) {
        throw new Error('이미지 파일명은 필수입니다.');
      }
    }
  }
}
