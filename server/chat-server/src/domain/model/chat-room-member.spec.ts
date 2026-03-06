import { ChatRoomMember } from './chat-room-member.js';

describe('ChatRoomMember', () => {
  it('생성 시 활성 상태', () => {
    const member = new ChatRoomMember(1, 10);
    expect(member.chatRoomId).toBe(1);
    expect(member.userId).toBe(10);
    expect(member.active).toBe(true);
    expect(member.online).toBe(true);
    expect(member.leftAt).toBeNull();
    expect(member.lastReadMessageId).toBeNull();
  });

  it('leave — 퇴장 처리', () => {
    const member = new ChatRoomMember(1, 10);
    member.leave();
    expect(member.active).toBe(false);
    expect(member.leftAt).not.toBeNull();
  });

  it('leave — 이미 퇴장한 상태에서 거부', () => {
    const member = new ChatRoomMember(1, 10);
    member.leave();
    expect(() => member.leave()).toThrow('이미 퇴장한 상태');
  });

  it('rejoin — 재입장', () => {
    const member = new ChatRoomMember(1, 10);
    member.leave();
    member.rejoin();
    expect(member.active).toBe(true);
    expect(member.online).toBe(true);
    expect(member.leftAt).toBeNull();
  });

  it('rejoin — 이미 활성 상태에서 거부', () => {
    const member = new ChatRoomMember(1, 10);
    expect(() => member.rejoin()).toThrow('이미 활성 상태');
  });

  it('updateActiveStatus — 온라인/오프라인', () => {
    const member = new ChatRoomMember(1, 10);
    member.updateActiveStatus(false);
    expect(member.online).toBe(false);
    member.updateActiveStatus(true);
    expect(member.online).toBe(true);
  });

  it('updateActivity — 활동 갱신 시 오프라인→온라인', () => {
    const member = new ChatRoomMember(1, 10);
    member.updateActiveStatus(false);
    expect(member.online).toBe(false);
    member.updateActivity();
    expect(member.online).toBe(true);
  });

  it('updateLastReadMessage — 더 큰 ID만 갱신', () => {
    const member = new ChatRoomMember(1, 10);
    member.updateLastReadMessage(5);
    expect(member.lastReadMessageId).toBe(5);
    member.updateLastReadMessage(3);
    expect(member.lastReadMessageId).toBe(5);
    member.updateLastReadMessage(10);
    expect(member.lastReadMessageId).toBe(10);
  });

  it('hasReadMessage', () => {
    const member = new ChatRoomMember(1, 10);
    expect(member.hasReadMessage(1)).toBe(false);
    member.updateLastReadMessage(5);
    expect(member.hasReadMessage(3)).toBe(true);
    expect(member.hasReadMessage(5)).toBe(true);
    expect(member.hasReadMessage(6)).toBe(false);
  });
});
