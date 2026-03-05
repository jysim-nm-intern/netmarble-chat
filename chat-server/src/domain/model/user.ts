/**
 * User 도메인 모델 (순수 TypeScript, 프레임워크 의존성 없음)
 */
export class User {
  id?: number;
  nickname: string;
  createdAt: Date;
  lastActiveAt: Date;
  active: boolean;
  profileColor: string;
  profileImage: string | null;

  constructor(
    nickname: string,
    profileColor?: string | null,
    profileImage?: string | null,
  ) {
    this.validateNickname(nickname);
    this.nickname = nickname;
    this.profileColor =
      profileColor && profileColor.trim() ? profileColor : '#4f85c8';
    this.profileImage = profileImage ?? null;
    this.createdAt = new Date();
    this.lastActiveAt = new Date();
    this.active = true;
  }

  private validateNickname(nickname: string): void {
    if (!nickname || !nickname.trim()) {
      throw new Error('닉네임은 비어있을 수 없습니다.');
    }
    if (nickname.length < 2 || nickname.length > 50) {
      throw new Error('닉네임은 2자 이상 50자 이하여야 합니다.');
    }
    if (!/^[a-zA-Z0-9가-힣_]+$/.test(nickname)) {
      throw new Error(
        '닉네임은 영문, 숫자, 한글, 언더스코어만 사용할 수 있습니다.',
      );
    }
  }

  updateProfileColor(profileColor: string | null | undefined): void {
    if (profileColor && profileColor.trim()) {
      this.profileColor = profileColor;
    }
  }

  updateProfileImage(profileImage: string | null | undefined): void {
    this.profileImage = profileImage ?? null;
  }

  updateLastActive(): void {
    this.lastActiveAt = new Date();
  }

  deactivate(): void {
    this.active = false;
  }

  activate(): void {
    this.active = true;
    this.updateLastActive();
  }
}
