import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('헬스체크 응답', () => {
    const result = controller.health();
    expect(result).toEqual({ status: 'OK', message: 'Server is running' });
  });
});
