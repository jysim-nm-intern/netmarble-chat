package com.netmarble.chat.application.dto.cursor;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * Cursor-based 페이징 응답
 *
 * API: GET /api/rooms/{roomId}/messages?cursor={lastId}&limit=50&direction=BEFORE
 */
@Getter
@Builder
@AllArgsConstructor
public class CursorPageResponse<T> {

    private List<T> messages;

    /** 다음 페이지 조회에 사용할 커서 (마지막 메시지 ID) */
    private String nextCursor;

    /** 다음 페이지가 존재하는지 여부 */
    private boolean hasMore;

    /** 현재 페이지 메시지 수 */
    private int count;

    public static <T> CursorPageResponse<T> of(List<T> messages, String nextCursor, boolean hasMore) {
        return CursorPageResponse.<T>builder()
            .messages(messages)
            .nextCursor(nextCursor)
            .hasMore(hasMore)
            .count(messages.size())
            .build();
    }

    public static <T> CursorPageResponse<T> empty() {
        return CursorPageResponse.<T>builder()
            .messages(List.of())
            .nextCursor(null)
            .hasMore(false)
            .count(0)
            .build();
    }
}
