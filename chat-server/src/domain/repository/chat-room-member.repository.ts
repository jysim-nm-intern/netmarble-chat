import { ChatRoomMember } from '../model/chat-room-member.js';

export const CHAT_ROOM_MEMBER_REPOSITORY = Symbol(
  'ChatRoomMemberRepository',
);

export abstract class ChatRoomMemberRepository {
  abstract save(member: ChatRoomMember): Promise<ChatRoomMember>;
  abstract findActiveByChatRoomIdAndUserId(
    chatRoomId: number,
    userId: number,
  ): Promise<ChatRoomMember | null>;
  abstract findByChatRoomIdAndUserId(
    chatRoomId: number,
    userId: number,
  ): Promise<ChatRoomMember | null>;
  abstract findActiveChatRoomIdsByUserId(userId: number): Promise<Set<number>>;
  abstract findActiveByUserId(userId: number): Promise<ChatRoomMember[]>;
  abstract findActiveByChatRoomId(chatRoomId: number): Promise<ChatRoomMember[]>;
}
