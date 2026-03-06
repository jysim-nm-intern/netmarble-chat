import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../../domain/model/user.js';
import { UserRepository } from '../../../domain/repository/user.repository.js';
import { UserEntity } from '../entity/user.entity.js';

@Injectable()
export class TypeormUserRepository extends UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {
    super();
  }

  async save(user: User): Promise<User> {
    const entity = this.toEntity(user);
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: number): Promise<User | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? this.toDomain(entity) : null;
  }

  async findByNickname(nickname: string): Promise<User | null> {
    const entity = await this.repo.findOneBy({ nickname });
    return entity ? this.toDomain(entity) : null;
  }

  async findAllActiveUsers(): Promise<User[]> {
    const entities = await this.repo.findBy({ active: true });
    return entities.map((e) => this.toDomain(e));
  }

  async findByIds(ids: number[]): Promise<Map<number, User>> {
    if (ids.length === 0) return new Map();
    const entities = await this.repo.findBy({ id: In(ids) });
    const map = new Map<number, User>();
    for (const e of entities) {
      map.set(e.id, this.toDomain(e));
    }
    return map;
  }

  async existsByNickname(nickname: string): Promise<boolean> {
    return this.repo.existsBy({ nickname });
  }

  async delete(user: User): Promise<void> {
    if (user.id) await this.repo.delete(user.id);
  }

  private toEntity(user: User): UserEntity {
    const entity = new UserEntity();
    if (user.id) entity.id = user.id;
    entity.nickname = user.nickname;
    entity.createdAt = user.createdAt;
    entity.lastActiveAt = user.lastActiveAt;
    entity.active = user.active;
    entity.profileColor = user.profileColor;
    entity.profileImage = user.profileImage;
    return entity;
  }

  private toDomain(entity: UserEntity): User {
    const user = Object.create(User.prototype) as User;
    user.id = entity.id;
    user.nickname = entity.nickname;
    user.createdAt = entity.createdAt;
    user.lastActiveAt = entity.lastActiveAt;
    user.active = entity.active;
    user.profileColor = entity.profileColor;
    user.profileImage = entity.profileImage;
    return user;
  }
}
