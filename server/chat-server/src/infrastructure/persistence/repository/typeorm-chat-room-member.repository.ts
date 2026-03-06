import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ChatRoomMember } from '../../../domain/model/chat-room-member.js';
import { ChatRoomMemberRepository } from '../../../domain/repository/chat-room-member.repository.js';
import { ChatRoomMemberEntity } from '../entity/chat-room-member.entity.js';

@Injectable()
export class TypeormChatRoomMemberRepository extends ChatRoomMemberRepository {
  constructor(
    @InjectRepository(ChatRoomMemberEntity)
    private readonly repo: Repository<ChatRoomMemberEntity>,
  ) {
    super();
  }

  async save(member: ChatRoomMember): Promise<ChatRoomMember> {
    const entity = this.toEntity(member);
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async findActiveByChatRoomIdAndUserId(
    chatRoomId: number,
    userId: number,
  ): Promise<ChatRoomMember | null> {
    const entity = await this.repo.findOneBy({
      chatRoomId,
      userId,
      active: true,
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByChatRoomIdAndUserId(
    chatRoomId: number,
    userId: number,
  ): Promise<ChatRoomMember | null> {
    const entity = await this.repo.findOne({
      where: { chatRoomId, userId },
      order: { id: 'DESC' },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findActiveChatRoomIdsByUserId(userId: number): Promise<Set<number>> {
    const entities = await this.repo.find({
      where: { userId, active: true },
      select: ['chatRoomId'],
    });
    return new Set(entities.map((e) => e.chatRoomId));
  }

  async findActiveByUserId(userId: number): Promise<ChatRoomMember[]> {
    const entities = await this.repo.findBy({ userId, active: true });
    return entities.map((e) => this.toDomain(e));
  }

  async findActiveByChatRoomId(
    chatRoomId: number,
  ): Promise<ChatRoomMember[]> {
    const entities = await this.repo.findBy({ chatRoomId, active: true });
    return entities.map((e) => this.toDomain(e));
  }

  async findActiveByChatRoomIds(
    chatRoomIds: number[],
  ): Promise<Map<number, ChatRoomMember[]>> {
    if (chatRoomIds.length === 0) return new Map();
    const entities = await this.repo.find({
      where: { chatRoomId: In(chatRoomIds), active: true },
    });
    const map = new Map<number, ChatRoomMember[]>();
    for (const e of entities) {
      const list = map.get(e.chatRoomId) || [];
      list.push(this.toDomain(e));
      map.set(e.chatRoomId, list);
    }
    return map;
  }

  private toEntity(member: ChatRoomMember): ChatRoomMemberEntity {
    const entity = new ChatRoomMemberEntity();
    if (member.id) entity.id = member.id;
    entity.chatRoomId = member.chatRoomId;
    entity.userId = member.userId;
    entity.joinedAt = member.joinedAt;
    entity.leftAt = member.leftAt;
    entity.active = member.active;
    entity.online = member.online;
    entity.lastActiveAt = member.lastActiveAt;
    entity.lastReadMessageId = member.lastReadMessageId;
    return entity;
  }

  private toDomain(entity: ChatRoomMemberEntity): ChatRoomMember {
    const member = Object.create(ChatRoomMember.prototype) as ChatRoomMember;
    member.id = entity.id;
    member.chatRoomId = entity.chatRoomId;
    member.userId = entity.userId;
    member.joinedAt = entity.joinedAt;
    member.leftAt = entity.leftAt;
    member.active = entity.active;
    member.online = entity.online;
    member.lastActiveAt = entity.lastActiveAt;
    member.lastReadMessageId = entity.lastReadMessageId != null
      ? Number(entity.lastReadMessageId)
      : null;
    return member;
  }
}
