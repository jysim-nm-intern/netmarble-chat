/**
 * Attachment 도메인 모델
 */
export class Attachment {
  id?: number;
  messageId!: number;
  fileUrl: string;
  fileType: string;
  createdAt: Date;

  constructor(messageId: number, fileUrl: string, fileType: string) {
    if (!fileUrl || !fileUrl.trim()) {
      throw new Error('첨부파일 URL은 비어있을 수 없습니다.');
    }
    if (!fileType || !fileType.trim()) {
      throw new Error('첨부파일 타입은 비어있을 수 없습니다.');
    }
    this.messageId = messageId;
    this.fileUrl = fileUrl;
    this.fileType = fileType;
    this.createdAt = new Date();
  }
}
