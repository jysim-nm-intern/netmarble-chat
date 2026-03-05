package com.netmarble.chat.infrastructure.storage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class LocalFileStorageServiceTest {

    @TempDir
    Path tempDir;

    private LocalFileStorageService storageService;

    @BeforeEach
    void setUp() {
        storageService = new LocalFileStorageService(tempDir.toString());
    }

    private InputStream toStream(byte[] data) {
        return new ByteArrayInputStream(data);
    }

    @Test
    void store_JPG_파일_저장_성공() {
        byte[] content = new byte[1024];
        String url = storageService.store(toStream(content), "image/jpeg", "test.jpg", content.length, "messages");

        assertTrue(url.startsWith("/uploads/messages/"));
        assertTrue(url.endsWith(".jpg"));
        // 실제 파일이 존재하는지 확인
        String relativePath = url.substring("/uploads/".length());
        assertTrue(Files.exists(tempDir.resolve(relativePath)));
    }

    @Test
    void store_PNG_파일_저장_성공() {
        byte[] content = new byte[1024];
        String url = storageService.store(toStream(content), "image/png", "test.png", content.length, "profiles");

        assertTrue(url.startsWith("/uploads/profiles/"));
        assertTrue(url.endsWith(".png"));
    }

    @Test
    void store_GIF_파일_저장_성공() {
        byte[] content = new byte[1024];
        String url = storageService.store(toStream(content), "image/gif", "test.gif", content.length, "rooms");

        assertTrue(url.startsWith("/uploads/rooms/"));
        assertTrue(url.endsWith(".gif"));
    }

    @Test
    void store_UUID_파일명_생성_확인() {
        byte[] content = new byte[1024];
        String url = storageService.store(toStream(content), "image/jpeg", "original-name.jpg", content.length, "messages");

        // UUID 형식의 파일명 사용 (원본 파일명이 아닌지 확인)
        assertFalse(url.contains("original-name"));
    }

    @Test
    void store_날짜별_디렉토리_생성_확인() {
        byte[] content = new byte[1024];
        String url = storageService.store(toStream(content), "image/jpeg", "test.jpg", content.length, "messages");

        // /uploads/messages/yyyy/MM/dd/uuid.jpg 형식 확인
        String[] parts = url.split("/");
        assertEquals("uploads", parts[1]);
        assertEquals("messages", parts[2]);
        assertTrue(parts[3].matches("\\d{4}"));
        assertTrue(parts[4].matches("\\d{2}"));
        assertTrue(parts[5].matches("\\d{2}"));
    }

    @Test
    void store_contentType_기반_확장자_결정() {
        byte[] content = new byte[1024];
        // originalFilename이 .png여도 contentType이 image/jpeg이면 .jpg로 저장
        String url = storageService.store(toStream(content), "image/jpeg", "fake.png", content.length, "messages");

        assertTrue(url.endsWith(".jpg"));
    }

    @Test
    void store_허용되지_않는_contentType_예외() {
        byte[] content = new byte[1024];
        assertThrows(IllegalArgumentException.class,
                () -> storageService.store(toStream(content), "image/bmp", "test.bmp", content.length, "messages"));
    }

    @Test
    void store_5MB_초과_파일_예외() {
        long largeSize = 6L * 1024 * 1024; // 6MB
        byte[] content = new byte[1024]; // 실제 스트림 데이터는 작지만 fileSize로 검증

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> storageService.store(toStream(content), "image/jpeg", "large.jpg", largeSize, "messages"));
        assertTrue(ex.getMessage().contains("5MB"));
    }

    @Test
    void store_빈_파일_예외() {
        assertThrows(IllegalArgumentException.class,
                () -> storageService.store(toStream(new byte[0]), "image/jpeg", "empty.jpg", 0, "messages"));
    }

    @Test
    void store_null_contentType_예외() {
        byte[] content = new byte[1024];
        assertThrows(IllegalArgumentException.class,
                () -> storageService.store(toStream(content), null, "test.jpg", content.length, "messages"));
    }

    @Test
    void store_허용되지_않는_type_예외() {
        byte[] content = new byte[1024];
        assertThrows(IllegalArgumentException.class,
                () -> storageService.store(toStream(content), "image/jpeg", "test.jpg", content.length, "../../etc"));
    }

    @Test
    void store_허용된_type만_성공() {
        byte[] content = new byte[1024];
        // profiles, rooms, messages만 허용
        assertDoesNotThrow(() ->
                storageService.store(toStream(content), "image/jpeg", "test.jpg", content.length, "profiles"));
        assertDoesNotThrow(() ->
                storageService.store(toStream(content), "image/jpeg", "test.jpg", content.length, "rooms"));
        assertDoesNotThrow(() ->
                storageService.store(toStream(content), "image/jpeg", "test.jpg", content.length, "messages"));
    }

    @Test
    void delete_존재하는_파일_삭제_성공() throws Exception {
        byte[] content = new byte[1024];
        String url = storageService.store(toStream(content), "image/jpeg", "test.jpg", content.length, "messages");

        String relativePath = url.substring("/uploads/".length());
        assertTrue(Files.exists(tempDir.resolve(relativePath)));

        storageService.delete(url);

        assertFalse(Files.exists(tempDir.resolve(relativePath)));
    }

    @Test
    void delete_존재하지_않는_파일_예외없음() {
        assertDoesNotThrow(() -> storageService.delete("/uploads/messages/2026/01/01/nonexistent.jpg"));
    }

    @Test
    void delete_null_경로_무시() {
        assertDoesNotThrow(() -> storageService.delete(null));
    }

    @Test
    void delete_빈_경로_무시() {
        assertDoesNotThrow(() -> storageService.delete(""));
    }

    @Test
    void delete_디렉토리_탈출_시도_차단() {
        assertDoesNotThrow(() -> storageService.delete("/uploads/../../../etc/passwd"));
    }
}
