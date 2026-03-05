/**
 * api-server 전용 메시지 응답 DTO.
 * MongoDB MessageDocument에서 직접 변환, domain Entity 의존성 없음.
 */
export class MessageResponse {
  id: number | null;
  chatRoomId: number | null;
  senderId: number | null;
  senderNickname: string;
  content: string | null;
  type: string;
  messageType: string;
  sentAt: string | null;
  deleted: boolean;
  unreadCount: number | null;
  attachmentUrl: string | null;
  attachmentType: string | null;

  constructor(params: {
    id?: number | null;
    chatRoomId?: number | null;
    senderId?: number | null;
    senderNickname?: string;
    content?: string | null;
    type?: string;
    sentAt?: Date | null;
    deleted?: boolean;
    unreadCount?: number | null;
    attachmentUrl?: string | null;
    attachmentType?: string | null;
  }) {
    this.id = params.id ?? null;
    this.chatRoomId = params.chatRoomId ?? null;
    this.senderId = params.senderId ?? null;
    this.senderNickname = params.senderNickname ?? 'System';
    this.content = params.content ?? null;
    this.type = params.type ?? 'TEXT';
    this.messageType = params.type ?? 'TEXT';
    this.sentAt = params.sentAt?.toISOString() ?? null;
    this.deleted = params.deleted ?? false;
    this.unreadCount = params.unreadCount ?? null;
    this.attachmentUrl = params.attachmentUrl ?? null;
    this.attachmentType = params.attachmentType ?? null;
  }
}
