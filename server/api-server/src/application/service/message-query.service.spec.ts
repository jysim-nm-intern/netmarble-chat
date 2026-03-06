import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import {
  MessageQueryService,
  Direction,
} from './message-query.service.js';
import { MessageMongoRepository } from '../../infrastructure/mongo/repository/message-mongo.repository.js';

describe('MessageQueryService', () => {
  let service: MessageQueryService;
  let repository: jest.Mocked<MessageMongoRepository>;

  const makeDoc = (roomId: string, senderId: string) => {
    const id = new Types.ObjectId();
    return {
      _id: id,
      roomId,
      senderId,
      senderNickname: '테스트유저',
      content: '테스트 메시지',
      type: 'TEXT',
      readCount: 0,
      createdAt: new Date(),
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageQueryService,
        {
          provide: MessageMongoRepository,
          useValue: {
            findByRoomIdLatest: jest.fn(),
            findByRoomIdBeforeCursor: jest.fn(),
            findByRoomIdAfterCursor: jest.fn(),
            existsByRoomIdBeforeCursor: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(MessageQueryService);
    repository = module.get(MessageMongoRepository);
  });

  it('cursor 없이 최신 메시지 반환', async () => {
    const docs = [makeDoc('room-1', '1'), makeDoc('room-1', '2')];
    repository.findByRoomIdLatest.mockResolvedValue(docs);
    repository.existsByRoomIdBeforeCursor.mockResolvedValue(false);

    const response = await service.findByCursor(
      'room-1',
      undefined,
      50,
      Direction.BEFORE,
    );

    expect(response.messages).toHaveLength(2);
    expect(response.hasMore).toBe(false);
    expect(response.nextCursor).toBeDefined();
  });

  it('cursor 있을 때 BEFORE 방향 이전 메시지 조회', async () => {
    const cursor = new Types.ObjectId();
    const docs = [makeDoc('room-1', '1')];
    repository.findByRoomIdBeforeCursor.mockResolvedValue(docs);
    repository.existsByRoomIdBeforeCursor.mockResolvedValue(false);

    const response = await service.findByCursor(
      'room-1',
      cursor.toHexString(),
      50,
      Direction.BEFORE,
    );

    expect(response.messages).toHaveLength(1);
    expect(repository.findByRoomIdBeforeCursor).toHaveBeenCalledWith(
      'room-1',
      expect.any(Types.ObjectId),
      50,
    );
  });

  it('결과 없으면 빈 응답 반환', async () => {
    repository.findByRoomIdLatest.mockResolvedValue([]);

    const response = await service.findByCursor(
      'room-empty',
      undefined,
      50,
      Direction.BEFORE,
    );

    expect(response.messages).toHaveLength(0);
    expect(response.hasMore).toBe(false);
    expect(response.nextCursor).toBeNull();
  });

  it('limit 100 초과 시 100으로 제한', async () => {
    repository.findByRoomIdLatest.mockResolvedValue([]);

    await service.findByCursor('room-1', undefined, 999, Direction.BEFORE);

    expect(repository.findByRoomIdLatest).toHaveBeenCalledWith('room-1', 100);
  });

  it('다음 페이지 존재 시 hasMore=true 반환', async () => {
    const docs = [makeDoc('room-1', '1'), makeDoc('room-1', '2')];
    repository.findByRoomIdLatest.mockResolvedValue(docs);
    repository.existsByRoomIdBeforeCursor.mockResolvedValue(true);

    const response = await service.findByCursor(
      'room-1',
      undefined,
      50,
      Direction.BEFORE,
    );

    expect(response.hasMore).toBe(true);
  });
});
