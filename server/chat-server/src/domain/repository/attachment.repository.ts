import { Attachment } from '../model/attachment.js';

export const ATTACHMENT_REPOSITORY = Symbol('AttachmentRepository');

export abstract class AttachmentRepository {
  abstract save(attachment: Attachment): Promise<Attachment>;
  abstract findByMessageId(messageId: number): Promise<Attachment | null>;
  abstract findByMessageIds(messageIds: number[]): Promise<Map<number, Attachment>>;
  abstract delete(attachment: Attachment): Promise<void>;
}
