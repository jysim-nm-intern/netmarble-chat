/**
 * ChatRoom 도메인 모델
 */
export class ChatRoom {
  id?: number;
  name: string;
  imageUrl: string | null;
  creatorId!: number;
  createdAt: Date;
  active: boolean;
  version?: number;

  constructor(name: string, imageUrl: string | null, creatorId: number) {
    this.validateName(name);
    this.name = name;
    this.imageUrl = imageUrl;
    this.creatorId = creatorId;
    this.createdAt = new Date();
    this.active = true;
  }

  private validateName(name: string): void {
    if (!name || !name.trim()) {
      throw new Error('채팅방 이름은 비어있을 수 없습니다.');
    }
    if (name.length < 2 || name.length > 100) {
      throw new Error('채팅방 이름은 2자 이상 100자 이하여야 합니다.');
    }
  }

  deactivate(): void {
    this.active = false;
  }

  updateInfo(name?: string | null, imageUrl?: string | null): void {
    if (name) {
      this.validateName(name);
      this.name = name;
    }
    if (imageUrl !== undefined) {
      this.imageUrl = imageUrl;
    }
  }
}
