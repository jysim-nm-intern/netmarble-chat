import { Inject, Injectable, Logger } from '@nestjs/common';
import { User } from '../../domain/model/user.js';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../domain/repository/user.repository.js';
import { CreateUserRequest, UserResponse } from '../dto/index.js';

@Injectable()
export class UserApplicationService {
  private readonly logger = new Logger(UserApplicationService.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async createUser(request: CreateUserRequest): Promise<UserResponse> {
    this.logger.log(`Creating or logging in user: ${request.nickname}`);

    const existing = await this.userRepository.findByNickname(
      request.nickname,
    );
    if (existing) {
      this.logger.log(`User already exists, logging in: id=${existing.id}`);
      existing.updateLastActive();
      existing.updateProfileColor(request.profileColor);
      existing.updateProfileImage(request.profileImage);
      const updated = await this.userRepository.save(existing);
      return UserResponse.from(updated);
    }

    const user = new User(
      request.nickname,
      request.profileColor,
      request.profileImage,
    );
    const saved = await this.userRepository.save(user);
    this.logger.log(`User created: id=${saved.id}`);
    return UserResponse.from(saved);
  }

  async getUserById(id: number): Promise<UserResponse> {
    const user = await this.userRepository.findById(id);
    if (!user)
      throw new Error('사용자를 찾을 수 없습니다: ' + id);
    return UserResponse.from(user);
  }

  async getUserByNickname(nickname: string): Promise<UserResponse> {
    const user = await this.userRepository.findByNickname(nickname);
    if (!user)
      throw new Error('사용자를 찾을 수 없습니다: ' + nickname);
    return UserResponse.from(user);
  }

  async getActiveUsers(): Promise<UserResponse[]> {
    const users = await this.userRepository.findAllActiveUsers();
    return users.map(UserResponse.from);
  }

  async isNicknameAvailable(nickname: string): Promise<boolean> {
    return !(await this.userRepository.existsByNickname(nickname));
  }

  async updateUserActivity(userId: number): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('사용자를 찾을 수 없습니다: ' + userId);
    user.updateLastActive();
    await this.userRepository.save(user);
  }
}
