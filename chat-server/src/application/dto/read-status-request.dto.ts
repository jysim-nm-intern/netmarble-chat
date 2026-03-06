export class ReadStatusRequest {
  roomId!: number;
  userId!: number;
  lastReadMessageId?: number;
}
