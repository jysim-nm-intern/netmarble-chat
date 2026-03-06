import { UserApplicationService } from './user-application.service.js';
import { UserRepository } from '../../domain/repository/user.repository.js';
import { User } from '../../domain/model/user.js';
import { CreateUserRequest, UserResponse } from '../dto/index.js';

describe('UserApplicationService', () => {
  let service: UserApplicationService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockUserRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByNickname: jest.fn(),
      findAllActiveUsers: jest.fn(),
      existsByNickname: jest.fn(),
      delete: jest.fn(),
    } as any;

    service = new UserApplicationService(mockUserRepository);
  });

  describe('createUser', () => {
    it('새 사용자 생성', async () => {
      mockUserRepository.findByNickname.mockResolvedValue(null);
      const savedUser = new User('testUser', '#ff0000');
      savedUser.id = 1;
      mockUserRepository.save.mockResolvedValue(savedUser);

      const request = new CreateUserRequest();
      request.nickname = 'testUser';
      request.profileColor = '#ff0000';

      const result = await service.createUser(request);
      expect(result).toBeInstanceOf(UserResponse);
      expect(result.nickname).toBe('testUser');
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('기존 사용자 로그인', async () => {
      const existing = new User('testUser');
      existing.id = 1;
      mockUserRepository.findByNickname.mockResolvedValue(existing);
      mockUserRepository.save.mockResolvedValue(existing);

      const request = new CreateUserRequest();
      request.nickname = 'testUser';

      const result = await service.createUser(request);
      expect(result.nickname).toBe('testUser');
      expect(mockUserRepository.save).toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('존재하는 사용자 조회', async () => {
      const user = new User('testUser');
      user.id = 1;
      mockUserRepository.findById.mockResolvedValue(user);

      const result = await service.getUserById(1);
      expect(result.nickname).toBe('testUser');
    });

    it('존재하지 않는 사용자 조회 시 오류', async () => {
      mockUserRepository.findById.mockResolvedValue(null);
      await expect(service.getUserById(999)).rejects.toThrow(
        '사용자를 찾을 수 없습니다',
      );
    });
  });

  describe('isNicknameAvailable', () => {
    it('사용 가능한 닉네임', async () => {
      mockUserRepository.existsByNickname.mockResolvedValue(false);
      expect(await service.isNicknameAvailable('newUser')).toBe(true);
    });

    it('이미 사용 중인 닉네임', async () => {
      mockUserRepository.existsByNickname.mockResolvedValue(true);
      expect(await service.isNicknameAvailable('existingUser')).toBe(false);
    });
  });

  describe('getActiveUsers', () => {
    it('활성 사용자 목록 반환', async () => {
      const user1 = new User('user1');
      user1.id = 1;
      const user2 = new User('user2');
      user2.id = 2;
      mockUserRepository.findAllActiveUsers.mockResolvedValue([user1, user2]);

      const result = await service.getActiveUsers();
      expect(result).toHaveLength(2);
    });
  });
});
