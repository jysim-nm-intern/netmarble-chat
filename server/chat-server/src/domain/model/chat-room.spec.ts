import { ChatRoom } from './chat-room.js';

describe('ChatRoom', () => {
  it('유효한 이름으로 생성', () => {
    const room = new ChatRoom('테스트방', null, 1);
    expect(room.name).toBe('테스트방');
    expect(room.imageUrl).toBeNull();
    expect(room.creatorId).toBe(1);
    expect(room.active).toBe(true);
  });

  it('이미지 URL과 함께 생성', () => {
    const room = new ChatRoom('테스트방', 'data:image/png;base64,abc', 1);
    expect(room.imageUrl).toBe('data:image/png;base64,abc');
  });

  it('빈 이름 거부', () => {
    expect(() => new ChatRoom('', null, 1)).toThrow('비어있을 수 없습니다');
  });

  it('1자 이름 거부', () => {
    expect(() => new ChatRoom('a', null, 1)).toThrow(
      '2자 이상 100자 이하',
    );
  });

  it('101자 이름 거부', () => {
    expect(() => new ChatRoom('a'.repeat(101), null, 1)).toThrow(
      '2자 이상 100자 이하',
    );
  });

  it('deactivate', () => {
    const room = new ChatRoom('테스트방', null, 1);
    room.deactivate();
    expect(room.active).toBe(false);
  });

  it('updateInfo — 이름 변경', () => {
    const room = new ChatRoom('테스트방', null, 1);
    room.updateInfo('새이름', null);
    expect(room.name).toBe('새이름');
  });

  it('updateInfo — 이미지 변경', () => {
    const room = new ChatRoom('테스트방', null, 1);
    room.updateInfo(null, 'new-image-url');
    expect(room.imageUrl).toBe('new-image-url');
  });
});
