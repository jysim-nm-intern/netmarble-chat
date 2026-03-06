import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChatRoom } from '../../domain/model/chat-room.js';
import { ChatRoomMember } from '../../domain/model/chat-room-member.js';
import { Message, MessageType } from '../../domain/model/message.js';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repository/user.repository.js';
import {
  CHAT_ROOM_REPOSITORY,
  ChatRoomRepository,
} from '../../domain/repository/chat-room.repository.js';
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
  ChatRoomResponse,
  ChatRoomMemberResponse,
  CreateChatRoomRequest,
  JoinChatRoomRequest,
  MemberAvatar,
  MessageResponse,
} from '../dto/index.js';

@Injectable()
export class ChatRoomApplicationService {
  private readonly logger = new Logger(ChatRoomApplicationService.name);

  constructor(
    @Inject(CHAT_ROOM_REPOSITORY)
    private readonly chatRoomRepository: ChatRoomRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepository: MessageRepository,
    @Inject(CHAT_ROOM_MEMBER_REPOSITORY)
    private readonly chatRoomMemberRepository: ChatRoomMemberRepository,
    private readonly stompBroker: StompBrokerService,
  ) {}

  async createChatRoom(
    request: CreateChatRoomRequest,
  ): Promise<ChatRoomResponse> {
    const creator = await this.userRepository.findById(request.creatorId);
    if (!creator)
      throw new Error('사용자를 찾을 수 없습니다: ' + request.creatorId);

    const chatRoom = new ChatRoom(
      request.name,
      request.imageUrl ?? null,
      creator.id!,
    );
    const saved = await this.chatRoomRepository.save(chatRoom);

    // 생성자를 멤버로 추가
    const member = new ChatRoomMember(saved.id!, creator.id!);
    await this.chatRoomMemberRepository.save(member);

    // 시스템 메시지
    const sysMsg = Message.createSystemMessage(
      saved.id!,
      `${creator.nickname}님이 채팅방을 생성했습니다.`,
    );
    await this.messageRepository.save(sysMsg);

    return this.buildBasicResponse(saved, creator.nickname);
  }

  async getAllActiveChatRooms(
    userId: number | null,
  ): Promise<ChatRoomResponse[]> {
    const chatRooms = (await this.chatRoomRepository.findAllActive()).slice(
      0,
      100,
    );
    if (chatRooms.length === 0) return [];

    const roomIds = chatRooms.map((r) => r.id!);

    const memberRoomIds = userId
      ? await this.chatRoomMemberRepository.findActiveChatRoomIdsByUserId(
          userId,
        )
      : new Set<number>();

    // 배치 로드: creators, members, lastMessages (N+1 제거)
    const creatorIds = [...new Set(chatRooms.map((r) => r.creatorId))];
    const memberRoomIdList = roomIds.filter((id) => memberRoomIds.has(id));

    const [creatorsMap, membersMap, lastMessagesMap] = await Promise.all([
      this.userRepository.findByIds(creatorIds),
      this.chatRoomMemberRepository.findActiveByChatRoomIds(roomIds),
      this.messageRepository.findLastByChatRoomIds(memberRoomIdList),
    ]);

    // 아바타 유저 배치 로드
    const avatarUserIds = new Set<number>();
    for (const room of chatRooms) {
      const members = membersMap.get(room.id!) || [];
      members
        .filter((m) => userId === null || m.userId !== userId)
        .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
        .slice(0, 4)
        .forEach((m) => avatarUserIds.add(m.userId));
    }
    const avatarUsersMap = await this.userRepository.findByIds([
      ...avatarUserIds,
    ]);

    // 읽지 않은 메시지 수 병렬 조회 (전체 메시지 로드 → COUNT 쿼리로 전환)
    const unreadCounts = new Map<number, number>();
    if (userId) {
      const unreadPromises: Promise<void>[] = [];
      for (const roomId of memberRoomIdList) {
        const members = membersMap.get(roomId) || [];
        const userMember = members.find((m) => m.userId === userId);
        if (!userMember) continue;
        unreadPromises.push(
          (userMember.lastReadMessageId
            ? this.messageRepository.countByChatRoomIdAndIdGreaterThanAndSenderIdNot(
                roomId,
                userMember.lastReadMessageId,
                userId,
              )
            : this.messageRepository.countByChatRoomIdAndSenderIdNot(
                roomId,
                userId,
              )
          ).then((count) => {
            unreadCounts.set(roomId, count);
          }),
        );
      }
      await Promise.all(unreadPromises);
    }

    return chatRooms.map((room) => {
      const isMember = memberRoomIds.has(room.id!);
      const creator = creatorsMap.get(room.creatorId);
      const members = membersMap.get(room.id!) || [];

      let lastMessageContent: string | null = null;
      let lastMessageAt: Date | null = null;

      if (isMember) {
        const lastMsg = lastMessagesMap.get(room.id!);
        if (lastMsg) {
          lastMessageContent =
            lastMsg.type === MessageType.IMAGE
              ? '[사진]'
              : lastMsg.type === MessageType.STICKER
                ? '[스티커]'
                : lastMsg.content;
          lastMessageAt = lastMsg.sentAt;
        }
      }

      const avatarMembers = members
        .filter((m) => userId === null || m.userId !== userId)
        .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
        .slice(0, 4);

      const avatars: MemberAvatar[] = [];
      for (const m of avatarMembers) {
        const u = avatarUsersMap.get(m.userId);
        if (u) {
          const avatar = new MemberAvatar();
          avatar.profileColor = u.profileColor;
          avatar.profileImage = u.profileImage;
          avatar.nickname = u.nickname;
          avatars.push(avatar);
        }
      }

      const dto = new ChatRoomResponse();
      dto.id = room.id!;
      dto.name = room.name;
      dto.imageUrl = room.imageUrl;
      dto.creatorId = room.creatorId;
      dto.creatorNickname = creator?.nickname ?? 'Unknown';
      dto.createdAt = room.createdAt;
      dto.active = room.active;
      dto.memberCount = members.length;
      dto.unreadCount = unreadCounts.get(room.id!) ?? 0;
      dto.isMember = isMember;
      dto.lastMessageContent = lastMessageContent;
      dto.lastMessageAt = lastMessageAt;
      dto.memberAvatars = avatars;
      return dto;
    });
  }

  async getChatRoomById(id: number): Promise<ChatRoomResponse> {
    const room = await this.chatRoomRepository.findById(id);
    if (!room) throw new Error('채팅방을 찾을 수 없습니다: ' + id);
    const creator = await this.userRepository.findById(room.creatorId);
    return this.buildBasicResponse(room, creator?.nickname ?? 'Unknown');
  }

  async joinChatRoom(request: JoinChatRoomRequest): Promise<ChatRoomResponse> {
    const chatRoom = await this.chatRoomRepository.findById(
      request.chatRoomId,
    );
    if (!chatRoom)
      throw new Error('채팅방을 찾을 수 없습니다: ' + request.chatRoomId);

    const user = await this.userRepository.findById(request.userId);
    if (!user) throw new Error('사용자를 찾을 수 없습니다: ' + request.userId);

    // 기존 활성 멤버 확인
    let member =
      await this.chatRoomMemberRepository.findActiveByChatRoomIdAndUserId(
        request.chatRoomId,
        request.userId,
      );

    let isNewJoin = false;
    if (!member) {
      // 비활성 멤버 확인 (leave 후 재입장)
      const existing =
        await this.chatRoomMemberRepository.findByChatRoomIdAndUserId(
          request.chatRoomId,
          request.userId,
        );

      if (existing && !existing.active) {
        existing.rejoin();
        member = await this.chatRoomMemberRepository.save(existing);
      } else {
        member = await this.chatRoomMemberRepository.save(
          new ChatRoomMember(request.chatRoomId, request.userId),
        );
      }
      isNewJoin = true;
    }

    if (isNewJoin) {
      const sysMsg = Message.createSystemMessage(
        chatRoom.id!,
        `${user.nickname}님이 입장했습니다.`,
      );
      const savedMsg = await this.messageRepository.save(sysMsg);
      this.broadcastMessage(chatRoom.id!, savedMsg, null);
    }

    // 마지막 메시지까지 읽음 처리
    const lastMsg = await this.messageRepository.findLastByChatRoomId(
      chatRoom.id!,
    );
    if (lastMsg) {
      member.updateLastReadMessage(lastMsg.id!);
      member = await this.chatRoomMemberRepository.save(member);
    }

    const creator = await this.userRepository.findById(chatRoom.creatorId);
    return this.buildBasicResponse(chatRoom, creator?.nickname ?? 'Unknown');
  }

  async leaveChatRoom(chatRoomId: number, userId: number): Promise<void> {
    const chatRoom = await this.chatRoomRepository.findById(chatRoomId);
    if (!chatRoom) throw new Error('채팅방을 찾을 수 없습니다: ' + chatRoomId);

    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('사용자를 찾을 수 없습니다: ' + userId);

    const member =
      await this.chatRoomMemberRepository.findActiveByChatRoomIdAndUserId(
        chatRoomId,
        userId,
      );
    if (!member) throw new Error('채팅방에 참여하지 않은 사용자입니다.');
    member.leave();
    await this.chatRoomMemberRepository.save(member);

    const sysMsg = Message.createSystemMessage(
      chatRoomId,
      `${user.nickname}님이 퇴장했습니다.`,
    );
    const savedMsg = await this.messageRepository.save(sysMsg);
    this.broadcastMessage(chatRoomId, savedMsg, null);
  }

  async getActiveChatRoomMembers(
    chatRoomId: number,
  ): Promise<ChatRoomMemberResponse[]> {
    const members =
      await this.chatRoomMemberRepository.findActiveByChatRoomId(chatRoomId);
    if (members.length === 0) return [];

    // 배치 로드: 유저 정보 (N+1 제거)
    const userIds = members.map((m) => m.userId);
    const usersMap = await this.userRepository.findByIds(userIds);

    return members
      .filter((m) => usersMap.has(m.userId))
      .map((m) => {
        const user = usersMap.get(m.userId)!;
        const dto = new ChatRoomMemberResponse();
        dto.id = m.id!;
        dto.userId = user.id!;
        dto.nickname = user.nickname;
        dto.profileColor = user.profileColor;
        dto.profileImage = user.profileImage;
        dto.joinedAt = m.joinedAt;
        dto.leftAt = m.leftAt;
        dto.active = m.active;
        dto.lastReadMessageId = m.lastReadMessageId;
        return dto;
      });
  }

  async updateMemberActiveStatus(
    chatRoomId: number,
    userId: number,
    online: boolean,
  ): Promise<void> {
    const member =
      await this.chatRoomMemberRepository.findActiveByChatRoomIdAndUserId(
        chatRoomId,
        userId,
      );
    if (!member) return;
    member.updateActiveStatus(online);
    if (online) {
      const lastMsg =
        await this.messageRepository.findLastByChatRoomId(chatRoomId);
      if (lastMsg) member.updateLastReadMessage(lastMsg.id!);
    }
    await this.chatRoomMemberRepository.save(member);
  }

  async updateMemberActivity(
    chatRoomId: number,
    userId: number,
  ): Promise<void> {
    const member =
      await this.chatRoomMemberRepository.findActiveByChatRoomIdAndUserId(
        chatRoomId,
        userId,
      );
    if (!member) return;
    member.updateActivity();
    const lastMsg =
      await this.messageRepository.findLastByChatRoomId(chatRoomId);
    if (lastMsg) member.updateLastReadMessage(lastMsg.id!);
    await this.chatRoomMemberRepository.save(member);
  }

  private broadcastMessage(
    chatRoomId: number,
    message: Message,
    senderNickname: string | null,
  ): void {
    const response = new MessageResponse();
    response.id = message.id ?? null;
    response.chatRoomId = chatRoomId;
    response.senderId = message.sender?.id ?? null;
    response.senderNickname = senderNickname ?? 'System';
    response.content = message.content;
    response.type = message.type;
    response.messageType = message.type;
    response.sentAt = message.sentAt;
    response.deleted = message.deleted;
    this.stompBroker.send(
      `/topic/chatroom.${chatRoomId}`,
      JSON.stringify(response),
    );
  }

  private buildBasicResponse(
    room: ChatRoom,
    creatorNickname: string,
  ): ChatRoomResponse {
    const dto = new ChatRoomResponse();
    dto.id = room.id!;
    dto.name = room.name;
    dto.imageUrl = room.imageUrl;
    dto.creatorId = room.creatorId;
    dto.creatorNickname = creatorNickname;
    dto.createdAt = room.createdAt;
    dto.active = room.active;
    dto.memberCount = 0;
    return dto;
  }
}
