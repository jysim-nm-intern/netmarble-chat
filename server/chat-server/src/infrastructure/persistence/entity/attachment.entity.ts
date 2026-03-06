import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('attachments')
export class AttachmentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'message_id', unique: true })
  messageId!: number;

  @Column({ name: 'file_url', type: 'mediumtext' })
  fileUrl!: string;

  @Column({ name: 'file_type', length: 50 })
  fileType!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
