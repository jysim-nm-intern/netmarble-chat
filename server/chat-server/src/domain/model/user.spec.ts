import { User } from './user.js';

describe('User', () => {
  it('유효한 닉네임으로 생성', () => {
    const user = new User('testUser');
    expect(user.nickname).toBe('testUser');
    expect(user.profileColor).toBe('#4f85c8');
    expect(user.profileImage).toBeNull();
    expect(user.active).toBe(true);
  });

  it('프로필 색상과 이미지로 생성', () => {
    const user = new User('testUser', '#ff0000', 'data:image/png;base64,abc');
    expect(user.profileColor).toBe('#ff0000');
    expect(user.profileImage).toBe('data:image/png;base64,abc');
  });

  it('빈 닉네임 거부', () => {
    expect(() => new User('')).toThrow('비어있을 수 없습니다');
  });

  it('공백 닉네임 거부', () => {
    expect(() => new User('   ')).toThrow('비어있을 수 없습니다');
  });

  it('1자 닉네임 거부', () => {
    expect(() => new User('a')).toThrow('2자 이상 50자 이하');
  });

  it('51자 닉네임 거부', () => {
    expect(() => new User('a'.repeat(51))).toThrow('2자 이상 50자 이하');
  });

  it('특수문자 닉네임 거부', () => {
    expect(() => new User('test@user')).toThrow(
      '영문, 숫자, 한글, 언더스코어만',
    );
  });

  it('한글 닉네임 허용', () => {
    const user = new User('테스트유저');
    expect(user.nickname).toBe('테스트유저');
  });

  it('언더스코어 닉네임 허용', () => {
    const user = new User('test_user');
    expect(user.nickname).toBe('test_user');
  });

  it('updateLastActive로 활동 시간 갱신', () => {
    const user = new User('testUser');
    const before = user.lastActiveAt;
    user.updateLastActive();
    expect(user.lastActiveAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
  });

  it('deactivate/activate', () => {
    const user = new User('testUser');
    user.deactivate();
    expect(user.active).toBe(false);
    user.activate();
    expect(user.active).toBe(true);
  });

  it('프로필 색상 업데이트', () => {
    const user = new User('testUser');
    user.updateProfileColor('#00ff00');
    expect(user.profileColor).toBe('#00ff00');
  });

  it('빈 프로필 색상은 무시', () => {
    const user = new User('testUser');
    user.updateProfileColor('');
    expect(user.profileColor).toBe('#4f85c8');
  });
});
