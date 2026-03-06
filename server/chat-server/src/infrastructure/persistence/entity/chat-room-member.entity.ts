import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

@Entity('chat_room_members')
@Index('idx_crm_room_user', ['chatRoomId', 'userId'])
@Index('idx_crm_room_active', ['chatRoomId', 'active'])
export class ChatRoomMemberEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'chat_room_id' })
  chatRoomId!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'joined_at', type: 'timestamp' })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'timestamp', nullable: true })
  leftAt: Date | null = null;

  @Column({ default: true })
  active!: boolean;

  @Column({ default: true })
  online!: boolean;

  @Column({ name: 'last_active_at', type: 'timestamp' })
  lastActiveAt!: Date;

  @Column({ name: 'last_read_message_id', type: 'int', nullable: true })
  lastReadMessageId: number | null = null;
}
