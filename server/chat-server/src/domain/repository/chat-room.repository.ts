import { ChatRoom } from '../model/chat-room.js';

export const CHAT_ROOM_REPOSITORY = Symbol('ChatRoomRepository');

export abstract class ChatRoomRepository {
  abstract save(chatRoom: ChatRoom): Promise<ChatRoom>;
  abstract findById(id: number): Promise<ChatRoom | null>;
  abstract findAllActive(): Promise<ChatRoom[]>;
  abstract findByCreatorId(creatorId: number): Promise<ChatRoom[]>;
  abstract delete(chatRoom: ChatRoom): Promise<void>;
}
