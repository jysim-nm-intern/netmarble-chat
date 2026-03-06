export class ChatRoomMemberResponse {
  id!: number;
  userId!: number;
  nickname!: string;
  profileColor!: string;
  profileImage!: string | null;
  joinedAt!: Date;
  leftAt!: Date | null;
  active!: boolean;
  lastReadMessageId!: number | null;
}
