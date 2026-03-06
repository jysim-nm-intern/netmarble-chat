import { Message, MessageType } from './message.js';
import { User } from './user.js';

describe('Message', () => {
  let sender: User;

  beforeEach(() => {
    sender = new User('testUser');
    sender.id = 1;
  });

  it('텍스트 메시지 생성', () => {
    const msg = new Message(1, sender, '안녕하세요');
    expect(msg.chatRoomId).toBe(1);
    expect(msg.sender).toBe(sender);
    expect(msg.content).toBe('안녕하세요');
    expect(msg.type).toBe(MessageType.TEXT);
    expect(msg.deleted).toBe(false);
  });

  it('이미지 메시지 생성', () => {
    const msg = new Message(1, sender, 'image-data', MessageType.IMAGE);
    expect(msg.type).toBe(MessageType.IMAGE);
  });

  it('빈 내용 거부', () => {
    expect(() => new Message(1, sender, '')).toThrow('비어있을 수 없습니다');
  });

  it('공백 내용 거부', () => {
    expect(() => new Message(1, sender, '   ')).toThrow(
      '비어있을 수 없습니다',
    );
  });

  it('5000자 초과 텍스트 거부', () => {
    expect(() => new Message(1, sender, 'a'.repeat(5001))).toThrow(
      '5000자를 초과',
    );
  });

  it('5000자 텍스트 허용', () => {
    const msg = new Message(1, sender, 'a'.repeat(5000));
    expect(msg.content.length).toBe(5000);
  });

  it('이미지 메시지는 5000자 초과 허용', () => {
    const msg = new Message(
      1,
      sender,
      'a'.repeat(10000),
      MessageType.IMAGE,
    );
    expect(msg.content.length).toBe(10000);
  });

  it('삭제 처리', () => {
    const msg = new Message(1, sender, '안녕하세요');
    msg.delete();
    expect(msg.deleted).toBe(true);
  });

  it('시스템 메시지 생성', () => {
    const msg = Message.createSystemMessage(1, '시스템 메시지');
    expect(msg.type).toBe(MessageType.SYSTEM);
    expect(msg.sender).toBeNull();
    expect(msg.content).toBe('시스템 메시지');
  });
});
