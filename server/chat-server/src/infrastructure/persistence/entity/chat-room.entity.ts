import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

@Entity('chat_rooms')
@Index('idx_room_active', ['active'])
export class ChatRoomEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'image_url', type: 'mediumtext', nullable: true })
  imageUrl!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'creator_id' })
  creatorId!: number;

  @VersionColumn({ nullable: true })
  version!: number;

  @Column({ default: true })
  active!: boolean;
}
