import { Inject, Injectable, Logger } from '@nestjs/common';
import { Message, MessageType } from '../../domain/model/message.js';
import { Attachment } from '../../domain/model/attachment.js';
import { User } from '../../domain/model/user.js';
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
  ATTACHMENT_REPOSITORY,
  AttachmentRepository,
} from '../../domain/repository/attachment.repository.js';
import {
  CHAT_ROOM_MEMBER_REPOSITORY,
  ChatRoomMemberRepository,
} from '../../domain/repository/chat-room-member.repository.js';
import { SendMessageRequest, MessageResponse } from '../dto/index.js';

@Injectable()
export class MessageApplicationService {
  private readonly logger = new Logger(MessageApplicationService.name);

  constructor(
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepository: MessageRepository,
    @Inject(CHAT_ROOM_REPOSITORY)
    private readonly chatRoomRepository: ChatRoomRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(ATTACHMENT_REPOSITORY)
    private readonly attachmentRepository: AttachmentRepository,
    @Inject(CHAT_ROOM_MEMBER_REPOSITORY)
    private readonly chatRoomMemberRepository: ChatRoomMemberRepository,
  ) {}

  async sendMessage(request: SendMessageRequest): Promise<MessageResponse> {
    request.validateByMessageType();

    const chatRoom = await this.chatRoomRepository.findById(
      request.chatRoomId,
    );
    if (!chatRoom)
      throw new Error('채팅방을 찾을 수 없습니다: ' + request.chatRoomId);

    const sender = await this.userRepository.findById(request.senderId);
    if (!sender)
      throw new Error('사용자를 찾을 수 없습니다: ' + request.senderId);

    let savedMessage: Message;
    let attachment: Attachment | null = null;

    if (request.type === MessageType.IMAGE) {
      savedMessage = await this.messageRepository.save(
        new Message(
          chatRoom.id!,
          sender,
          request.fileName!,
          MessageType.IMAGE,
        ),
      );
      attachment = await this.attachmentRepository.save(
        new Attachment(savedMessage.id!, request.content, 'IMAGE'),
      );
    } else if (request.type === MessageType.STICKER) {
      savedMessage = await this.messageRepository.save(
        new Message(chatRoom.id!, sender, '[스티커]', MessageType.STICKER),
      );
      attachment = await this.attachmentRepository.save(
        new Attachment(savedMessage.id!, request.content, 'STICKER'),
      );
    } else {
      savedMessage = await this.messageRepository.save(
        new Message(chatRoom.id!, sender, request.content, request.type),
      );
    }

    const members =
      await this.chatRoomMemberRepository.findActiveByChatRoomId(chatRoom.id!);
    const unreadCount = members.filter(
      (m) => m.userId !== sender.id! && !m.hasReadMessage(savedMessage.id!),
    ).length;

    return this.buildResponse(savedMessage, sender, attachment, unreadCount);
  }

  async getChatRoomMessages(
    chatRoomId: number,
    userId: number | null,
  ): Promise<MessageResponse[]> {
    await this.chatRoomRepository.findById(chatRoomId);

    let messages: Message[];
    if (userId) {
      const member =
        await this.chatRoomMemberRepository.findActiveByChatRoomIdAndUserId(
          chatRoomId,
          userId,
        );
      if (!member) return [];
      messages =
        await this.messageRepository.findByChatRoomIdAndSentAtAfterOrderBySentAtAsc(
          chatRoomId,
          member.joinedAt,
        );
    } else {
      messages =
        await this.messageRepository.findByChatRoomIdOrderBySentAtAsc(
          chatRoomId,
        );
    }

    if (messages.length === 0) return [];

    // 배치 로드: senders, attachments (N+1 제거)
    const senderIds = [
      ...new Set(
        messages.filter((m) => m.sender?.id).map((m) => m.sender!.id!),
      ),
    ];
    const messageIds = messages.filter((m) => m.id).map((m) => m.id!);

    const [sendersMap, attachmentsMap, members] = await Promise.all([
      this.userRepository.findByIds(senderIds),
      this.attachmentRepository.findByMessageIds(messageIds),
      this.chatRoomMemberRepository.findActiveByChatRoomId(chatRoomId),
    ]);

    return messages.map((msg) => {
      const sender = msg.sender?.id
        ? (sendersMap.get(msg.sender.id) ?? null)
        : null;
      const attachment = msg.id
        ? (attachmentsMap.get(msg.id) ?? null)
        : null;
      const unreadCount = sender
        ? members.filter(
            (m) => m.userId !== sender.id! && !m.hasReadMessage(msg.id!),
          ).length
        : 0;
      return this.buildResponse(msg, sender, attachment, unreadCount);
    });
  }

  async getMessageById(id: number): Promise<MessageResponse> {
    const message = await this.messageRepository.findById(id);
    if (!message) throw new Error('메시지를 찾을 수 없습니다: ' + id);
    const sender = message.sender?.id
      ? await this.userRepository.findById(message.sender.id)
      : null;
    const attachment = await this.attachmentRepository.findByMessageId(id);
    return this.buildResponse(message, sender, attachment, 0);
  }

  async deleteMessage(messageId: number, userId: number): Promise<void> {
    const message = await this.messageRepository.findById(messageId);
    if (!message) throw new Error('메시지를 찾을 수 없습니다: ' + messageId);
    if (!message.sender || message.sender.id !== userId) {
      throw new Error('메시지를 삭제할 권한이 없습니다.');
    }
    message.delete();
    await this.messageRepository.save(message);
  }

  async searchMessages(
    chatRoomId: number,
    keyword: string,
  ): Promise<MessageResponse[]> {
    if (!keyword || !keyword.trim()) {
      throw new Error('검색어는 비어있을 수 없습니다.');
    }
    const trimmed = keyword.trim();
    if (trimmed.length > 255) {
      throw new Error('검색어는 255자를 초과할 수 없습니다.');
    }

    const chatRoom = await this.chatRoomRepository.findById(chatRoomId);
    if (!chatRoom) throw new Error('채팅방을 찾을 수 없습니다: ' + chatRoomId);

    const messages = await this.messageRepository.searchByChatRoomIdAndKeyword(
      chatRoomId,
      trimmed,
    );
    if (messages.length === 0) return [];

    // 배치 로드: senders, attachments, members (N+1 제거)
    const senderIds = [
      ...new Set(
        messages.filter((m) => m.sender?.id).map((m) => m.sender!.id!),
      ),
    ];
    const messageIds = messages.filter((m) => m.id).map((m) => m.id!);

    const [sendersMap, attachmentsMap, members] = await Promise.all([
      this.userRepository.findByIds(senderIds),
      this.attachmentRepository.findByMessageIds(messageIds),
      this.chatRoomMemberRepository.findActiveByChatRoomId(chatRoomId),
    ]);

    return messages.map((msg) => {
      const sender = msg.sender?.id
        ? (sendersMap.get(msg.sender.id) ?? null)
        : null;
      const attachment = msg.id
        ? (attachmentsMap.get(msg.id) ?? null)
        : null;
      const unreadCount = sender
        ? members.filter(
            (m) => m.userId !== sender.id! && !m.hasReadMessage(msg.id!),
          ).length
        : 0;
      return this.buildResponse(msg, sender, attachment, unreadCount);
    });
  }

  private buildResponse(
    message: Message,
    sender: User | null,
    attachment: Attachment | null,
    unreadCount: number,
  ): MessageResponse {
    const dto = new MessageResponse();
    dto.id = message.id ?? null;
    dto.chatRoomId = message.chatRoomId;
    dto.senderId = sender?.id ?? null;
    dto.senderNickname = sender?.nickname ?? 'System';
    dto.content = message.content;
    dto.type = message.type;
    dto.messageType = message.type;
    dto.sentAt = message.sentAt;
    dto.deleted = message.deleted;
    dto.unreadCount = unreadCount;
    dto.attachmentUrl = attachment?.fileUrl ?? null;
    dto.attachmentType = attachment?.fileType ?? null;
    return dto;
  }
}
