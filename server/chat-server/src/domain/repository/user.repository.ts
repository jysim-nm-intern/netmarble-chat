import { User } from '../model/user.js';

export const USER_REPOSITORY = Symbol('UserRepository');

export abstract class UserRepository {
  abstract save(user: User): Promise<User>;
  abstract findById(id: number): Promise<User | null>;
  abstract findByNickname(nickname: string): Promise<User | null>;
  abstract findAllActiveUsers(): Promise<User[]>;
  abstract findByIds(ids: number[]): Promise<Map<number, User>>;
  abstract existsByNickname(nickname: string): Promise<boolean>;
  abstract delete(user: User): Promise<void>;
}
