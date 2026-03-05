import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repository/user.repository.js';
import {
  MESSAGE_REPOSITORY,
  MessageRepository,
} from '../../domain/repository/message.repository.js';
import {
  CHAT_ROOM_MEMBER_REPOSITORY,
  ChatRoomMemberRepository,
} from '../../domain/repository/chat-room-member.repository.js';
import { StompBrokerService } from '../../infrastructure/config/stomp-broker.service.js';
import {
  ReadStatusUpdateEvent,
  UnreadCountResponse,
} from '../dto/index.js';

@Injectable()
export class ReadStatusApplicationService {
  private readonly logger = new Logger(ReadStatusApplicationService.name);

  constructor(
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepository: MessageRepository,
    @Inject(CHAT_ROOM_MEMBER_REPOSITORY)
    private readonly chatRoomMemberRepository: ChatRoomMemberRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly stompBroker: StompBrokerService,
  ) {}

  async markAsRead(userId: number, chatRoomId: number): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('사용자를 찾을 수 없습니다: ' + userId);

    const lastMessage =
      await this.messageRepository.findLastByChatRoomId(chatRoomId);
    if (!lastMessage) return;

    const member =
      await this.chatRoomMemberRepository.findActiveByChatRoomIdAndUserId(
        chatRoomId,
        userId,
      );
    if (!member) throw new Error('채팅방 멤버를 찾을 수 없습니다');

    member.updateLastReadMessage(lastMessage.id!);
    await this.chatRoomMemberRepository.save(member);

    // WebSocket 알림
    const event = new ReadStatusUpdateEvent();
    event.chatRoomId = chatRoomId;
    event.userId = userId;
    event.userNickname = user.nickname;
    event.lastReadMessageId = lastMessage.id!;
    event.updatedAt = new Date();
    this.stompBroker.send(
      `/topic/chatroom.${chatRoomId}.read-status`,
      JSON.stringify(event),
    );
  }

  async getUnreadCount(userId: number, chatRoomId: number): Promise<number> {
    const member =
      await this.chatRoomMemberRepository.findActiveByChatRoomIdAndUserId(
        chatRoomId,
        userId,
      );
    if (!member) return 0;

    const allMessages =
      await this.messageRepository.findByChatRoomIdOrderBySentAtAsc(
        chatRoomId,
      );

    if (!member.lastReadMessageId) {
      return allMessages.filter(
        (m) => m.sender && m.sender.id !== userId,
      ).length;
    }

    let foundLastRead = false;
    let count = 0;
    for (const msg of allMessages) {
      if (msg.id === member.lastReadMessageId) {
        foundLastRead = true;
        continue;
      }
      if (foundLastRead && msg.sender && msg.sender.id !== userId) {
        count++;
      }
    }
    return count;
  }

  async getAllUnreadCounts(
    userId: number,
  ): Promise<Map<number, number>> {
    const members =
      await this.chatRoomMemberRepository.findActiveByUserId(userId);
    const result = new Map<number, number>();

    for (const member of members) {
      result.set(
        member.chatRoomId,
        await this.getUnreadCount(userId, member.chatRoomId),
      );
    }
    return result;
  }

  async getUnreadCountsForActiveChatRooms(
    userId: number,
  ): Promise<UnreadCountResponse[]> {
    const counts = await this.getAllUnreadCounts(userId);
    const results: UnreadCountResponse[] = [];
    for (const [chatRoomId, unreadCount] of counts) {
      const dto = new UnreadCountResponse();
      dto.chatRoomId = chatRoomId;
      dto.unreadCount = unreadCount;
      results.push(dto);
    }
    return results;
  }
}
