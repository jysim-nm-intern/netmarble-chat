import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get(HealthController);
  });

  it('상태 OK 응답 반환', () => {
    const result = controller.health();
    expect(result).toEqual({ status: 'OK', message: 'Server is running' });
  });
});
