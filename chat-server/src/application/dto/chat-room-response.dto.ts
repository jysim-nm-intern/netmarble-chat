export class MemberAvatar {
  profileColor!: string;
  profileImage!: string | null;
  nickname!: string;
}

export class ChatRoomResponse {
  id!: number;
  name!: string;
  imageUrl!: string | null;
  creatorId!: number;
  creatorNickname!: string;
  createdAt!: Date;
  active!: boolean;
  memberCount!: number;
  unreadCount?: number;
  isMember?: boolean;
  lastMessageContent?: string | null;
  lastMessageAt?: Date | null;
  memberAvatars?: MemberAvatar[];
}
