import { UserDomainService } from './user-domain.service.js';
import { UserRepository } from '../repository/user.repository.js';
import { User } from '../model/user.js';

describe('UserDomainService', () => {
  let service: UserDomainService;
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

    service = new UserDomainService(mockUserRepository);
  });

  describe('validateNicknameUniqueness', () => {
    it('중복되지 않은 닉네임은 통과', async () => {
      mockUserRepository.existsByNickname.mockResolvedValue(false);
      await expect(
        service.validateNicknameUniqueness('newUser'),
      ).resolves.not.toThrow();
    });

    it('중복된 닉네임은 거부', async () => {
      mockUserRepository.existsByNickname.mockResolvedValue(true);
      await expect(
        service.validateNicknameUniqueness('existingUser'),
      ).rejects.toThrow('이미 사용 중인 닉네임');
    });
  });

  describe('createUser', () => {
    it('새 사용자 생성', async () => {
      mockUserRepository.existsByNickname.mockResolvedValue(false);
      const user = await service.createUser('newUser');
      expect(user).toBeInstanceOf(User);
      expect(user.nickname).toBe('newUser');
    });

    it('중복 닉네임 시 오류', async () => {
      mockUserRepository.existsByNickname.mockResolvedValue(true);
      await expect(service.createUser('existingUser')).rejects.toThrow(
        '이미 사용 중인 닉네임',
      );
    });
  });
});
