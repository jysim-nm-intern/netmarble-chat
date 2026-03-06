/**
 * ChatRoomMember 도메인 모델
 */
export class ChatRoomMember {
  id?: number;
  chatRoomId!: number;
  userId!: number;
  joinedAt: Date;
  leftAt: Date | null;
  active: boolean;
  online: boolean;
  lastActiveAt: Date;
  lastReadMessageId: number | null;

  constructor(chatRoomId: number, userId: number) {
    this.chatRoomId = chatRoomId;
    this.userId = userId;
    this.joinedAt = new Date();
    this.leftAt = null;
    this.active = true;
    this.online = true;
    this.lastActiveAt = new Date();
    this.lastReadMessageId = null;
  }

  leave(): void {
    if (!this.active) {
      throw new Error('이미 퇴장한 상태입니다.');
    }
    this.active = false;
    this.leftAt = new Date();
  }

  rejoin(): void {
    if (this.active) {
      throw new Error('이미 활성 상태입니다.');
    }
    this.active = true;
    this.online = true;
    this.joinedAt = new Date();
    this.leftAt = null;
    this.lastActiveAt = new Date();
  }

  updateActiveStatus(online: boolean): void {
    this.online = online;
    if (online) {
      this.lastActiveAt = new Date();
    }
  }

  updateActivity(): void {
    this.lastActiveAt = new Date();
    if (!this.online) {
      this.online = true;
    }
  }

  updateLastReadMessage(messageId: number): void {
    if (
      this.lastReadMessageId === null ||
      messageId > this.lastReadMessageId
    ) {
      this.lastReadMessageId = messageId;
      this.lastActiveAt = new Date();
    }
  }

  hasReadMessage(messageId: number): boolean {
    if (this.lastReadMessageId === null) return false;
    return this.lastReadMessageId >= messageId;
  }
}
