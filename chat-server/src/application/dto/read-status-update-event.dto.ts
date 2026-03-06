export class ReadStatusUpdateEvent {
  chatRoomId!: number;
  userId!: number;
  userNickname!: string;
  lastReadMessageId!: number;
  affectedMessageIds?: number[];
  updatedAt!: Date;
  type: string = 'READ_STATUS_UPDATE';
}
