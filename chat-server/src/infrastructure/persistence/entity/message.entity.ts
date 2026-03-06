import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('messages')
export class MessageEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'chat_room_id' })
  chatRoomId!: number;

  @Column({ name: 'sender_id', type: 'bigint', nullable: true })
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
