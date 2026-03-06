import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, length: 50 })
  nickname!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'last_active_at', type: 'timestamp' })
  lastActiveAt!: Date;

  @Column({ default: true })
  active!: boolean;

  @Column({ name: 'profile_color', length: 20, nullable: true })
  profileColor!: string;

  @Column({ name: 'profile_image', type: 'mediumtext', nullable: true })
  profileImage!: string | null;
}
