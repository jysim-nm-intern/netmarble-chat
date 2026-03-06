import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoom } from '../../../domain/model/chat-room.js';
import { ChatRoomRepository } from '../../../domain/repository/chat-room.repository.js';
import { ChatRoomEntity } from '../entity/chat-room.entity.js';

@Injectable()
export class TypeormChatRoomRepository extends ChatRoomRepository {
  constructor(
    @InjectRepository(ChatRoomEntity)
    private readonly repo: Repository<ChatRoomEntity>,
  ) {
    super();
  }

  async save(chatRoom: ChatRoom): Promise<ChatRoom> {
    const entity = this.toEntity(chatRoom);
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: number): Promise<ChatRoom | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? this.toDomain(entity) : null;
  }

  async findAllActive(): Promise<ChatRoom[]> {
    const entities = await this.repo.find({
      where: { active: true },
      order: { id: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findByCreatorId(creatorId: number): Promise<ChatRoom[]> {
    const entities = await this.repo.findBy({ creatorId });
    return entities.map((e) => this.toDomain(e));
  }

  async delete(chatRoom: ChatRoom): Promise<void> {
    if (chatRoom.id) await this.repo.delete(chatRoom.id);
  }

  private toEntity(chatRoom: ChatRoom): ChatRoomEntity {
    const entity = new ChatRoomEntity();
    if (chatRoom.id) entity.id = chatRoom.id;
    entity.name = chatRoom.name;
    entity.imageUrl = chatRoom.imageUrl;
    entity.creatorId = chatRoom.creatorId;
    entity.createdAt = chatRoom.createdAt;
    entity.active = chatRoom.active;
    if (chatRoom.version !== undefined) entity.version = chatRoom.version;
    return entity;
  }

  private toDomain(entity: ChatRoomEntity): ChatRoom {
    const room = Object.create(ChatRoom.prototype) as ChatRoom;
    room.id = entity.id;
    room.name = entity.name;
    room.imageUrl = entity.imageUrl;
    room.creatorId = entity.creatorId;
    room.createdAt = entity.createdAt;
    room.active = entity.active;
    room.version = entity.version;
    return room;
  }
}
