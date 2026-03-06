import { User } from '../../domain/model/user.js';

export class UserResponse {
  id!: number;
  nickname!: string;
  createdAt!: Date;
  lastActiveAt!: Date;
  active!: boolean;
  profileColor!: string;
  profileImage!: string | null;

  static from(user: User): UserResponse {
    const dto = new UserResponse();
    dto.id = user.id!;
    dto.nickname = user.nickname;
    dto.createdAt = user.createdAt;
    dto.lastActiveAt = user.lastActiveAt;
    dto.active = user.active;
    dto.profileColor = user.profileColor;
    dto.profileImage = user.profileImage;
    return dto;
  }
}
