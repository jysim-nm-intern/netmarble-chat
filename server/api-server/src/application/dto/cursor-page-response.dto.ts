/**
 * Cursor-based 페이지네이션 응답
 *
 * API: GET /api/rooms/{roomId}/messages?cursor={lastId}&limit=50&direction=BEFORE
 */
export class CursorPageResponse<T> {
  messages: T[];
  nextCursor: string | null;
  hasMore: boolean;
  count: number;

  private constructor(
    messages: T[],
    nextCursor: string | null,
    hasMore: boolean,
  ) {
    this.messages = messages;
    this.nextCursor = nextCursor;
    this.hasMore = hasMore;
    this.count = messages.length;
  }

  static of<T>(
    messages: T[],
    nextCursor: string | null,
    hasMore: boolean,
  ): CursorPageResponse<T> {
    return new CursorPageResponse(messages, nextCursor, hasMore);
  }

  static empty<T>(): CursorPageResponse<T> {
    return new CursorPageResponse<T>([], null, false);
  }
}
