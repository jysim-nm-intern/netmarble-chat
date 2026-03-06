import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

@Entity('messages')
@Index('idx_msg_room_deleted', ['chatRoomId', 'deleted'])
@Index('idx_msg_room_sent', ['chatRoomId', 'sentAt'])
@Index('idx_msg_sender', ['senderId'])
export class MessageEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'chat_room_id' })
  chatRoomId!: number;

  @Column({ name: 'sender_id', type: 'int', nullable: true })
  senderId: number | null = null;

  @Column({ type: 'text' })
  content!: string;

  @Column({ length: 20 })
  type!: string;

  @Column({ name: 'sent_at', type: 'timestamp' })
  sentAt!: Date;

  @Column({ default: false })
  deleted!: boolean;
}
