import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Like } from 'typeorm';
import { Message, MessageType } from '../../../domain/model/message.js';
import { MessageRepository } from '../../../domain/repository/message.repository.js';
import { MessageEntity } from '../entity/message.entity.js';

@Injectable()
export class TypeormMessageRepository extends MessageRepository {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly repo: Repository<MessageEntity>,
  ) {
    super();
  }

  async save(message: Message): Promise<Message> {
    const entity = this.toEntity(message);
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: number): Promise<Message | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? this.toDomain(entity) : null;
  }

  async findByChatRoomId(chatRoomId: number): Promise<Message[]> {
    const entities = await this.repo.findBy({
      chatRoomId,
      deleted: false,
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findByChatRoomIdOrderBySentAtAsc(
    chatRoomId: number,
  ): Promise<Message[]> {
    const entities = await this.repo.find({
      where: { chatRoomId, deleted: false },
      order: { sentAt: 'ASC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async searchByChatRoomIdAndKeyword(
    chatRoomId: number,
    keyword: string,
  ): Promise<Message[]> {
    const entities = await this.repo.find({
      where: {
        chatRoomId,
        deleted: false,
        content: Like(`%${keyword}%`),
      },
      order: { sentAt: 'DESC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findByChatRoomIdAndSentAtAfterOrderBySentAtAsc(
    chatRoomId: number,
    since: Date,
  ): Promise<Message[]> {
    const entities = await this.repo.find({
      where: {
        chatRoomId,
        deleted: false,
        sentAt: MoreThanOrEqual(since),
      },
      order: { sentAt: 'ASC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findLastByChatRoomId(chatRoomId: number): Promise<Message | null> {
    const entity = await this.repo.findOne({
      where: { chatRoomId, deleted: false },
      order: { sentAt: 'DESC' },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async delete(message: Message): Promise<void> {
    if (message.id) await this.repo.delete(message.id);
  }

  private toEntity(message: Message): MessageEntity {
    const entity = new MessageEntity();
    if (message.id) entity.id = message.id;
    entity.chatRoomId = message.chatRoomId;
    entity.senderId = message.sender?.id ?? null;
    entity.content = message.content;
    entity.type = message.type;
    entity.sentAt = message.sentAt;
    entity.deleted = message.deleted;
    return entity;
  }

  private toDomain(entity: MessageEntity): Message {
    const message = Object.create(Message.prototype) as Message;
    message.id = entity.id;
    message.chatRoomId = entity.chatRoomId;
    message.sender = entity.senderId
      ? ({ id: entity.senderId } as any)
      : null;
    message.content = entity.content;
    message.type = entity.type as MessageType;
    message.sentAt = entity.sentAt;
    message.deleted = entity.deleted;
    return message;
  }
}
