import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment } from '../../../domain/model/attachment.js';
import { AttachmentRepository } from '../../../domain/repository/attachment.repository.js';
import { AttachmentEntity } from '../entity/attachment.entity.js';

@Injectable()
export class TypeormAttachmentRepository extends AttachmentRepository {
  constructor(
    @InjectRepository(AttachmentEntity)
    private readonly repo: Repository<AttachmentEntity>,
  ) {
    super();
  }

  async save(attachment: Attachment): Promise<Attachment> {
    const entity = this.toEntity(attachment);
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async findByMessageId(messageId: number): Promise<Attachment | null> {
    const entity = await this.repo.findOneBy({ messageId });
    return entity ? this.toDomain(entity) : null;
  }

  async delete(attachment: Attachment): Promise<void> {
    if (attachment.id) await this.repo.delete(attachment.id);
  }

  private toEntity(attachment: Attachment): AttachmentEntity {
    const entity = new AttachmentEntity();
    if (attachment.id) entity.id = attachment.id;
    entity.messageId = attachment.messageId;
    entity.fileUrl = attachment.fileUrl;
    entity.fileType = attachment.fileType;
    entity.createdAt = attachment.createdAt;
    return entity;
  }

  private toDomain(entity: AttachmentEntity): Attachment {
    const attachment = Object.create(Attachment.prototype) as Attachment;
    attachment.id = entity.id;
    attachment.messageId = entity.messageId;
    attachment.fileUrl = entity.fileUrl;
    attachment.fileType = entity.fileType;
    attachment.createdAt = entity.createdAt;
    return attachment;
  }
}
