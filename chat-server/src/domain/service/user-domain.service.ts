import { Inject, Injectable } from '@nestjs/common';
import { User } from '../model/user.js';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../repository/user.repository.js';

@Injectable()
export class UserDomainService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async validateNicknameUniqueness(nickname: string): Promise<void> {
    if (await this.userRepository.existsByNickname(nickname)) {
      throw new Error('이미 사용 중인 닉네임입니다: ' + nickname);
    }
  }

  async createUser(nickname: string): Promise<User> {
    await this.validateNicknameUniqueness(nickname);
    return new User(nickname);
  }
}
