export class MessageResponse {
  id!: number | null;
  chatRoomId!: number;
  senderId!: number | null;
  senderNickname!: string;
  content!: string;
  type!: string;
  messageType!: string;
  sentAt!: Date;
  deleted!: boolean;
  unreadCount?: number;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
}
