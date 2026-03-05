import { Message } from '../model/message.js';

export const MESSAGE_REPOSITORY = Symbol('MessageRepository');

export abstract class MessageRepository {
  abstract save(message: Message): Promise<Message>;
  abstract findById(id: number): Promise<Message | null>;
  abstract findByChatRoomId(chatRoomId: number): Promise<Message[]>;
  abstract findByChatRoomIdOrderBySentAtAsc(chatRoomId: number): Promise<Message[]>;
  abstract searchByChatRoomIdAndKeyword(
    chatRoomId: number,
    keyword: string,
  ): Promise<Message[]>;
  abstract findByChatRoomIdAndSentAtAfterOrderBySentAtAsc(
    chatRoomId: number,
    since: Date,
  ): Promise<Message[]>;
  abstract findLastByChatRoomId(chatRoomId: number): Promise<Message | null>;
  abstract delete(message: Message): Promise<void>;
}
