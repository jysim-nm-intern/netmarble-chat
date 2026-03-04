package com.netmarble.chat.infrastructure.storage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

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

    @Test
    void store_JPG_파일_저장_성공() {
        MockMultipartFile file = new MockMultipartFile(
                "image", "test.jpg", "image/jpeg", new byte[1024]);

        String url = storageService.store(file, "messages");

        assertTrue(url.startsWith("/uploads/messages/"));
        assertTrue(url.endsWith(".jpg"));
        // 실제 파일이 존재하는지 확인
        String relativePath = url.substring("/uploads/".length());
        assertTrue(Files.exists(tempDir.resolve(relativePath)));
    }

    @Test
    void store_PNG_파일_저장_성공() {
        MockMultipartFile file = new MockMultipartFile(
                "image", "test.png", "image/png", new byte[1024]);

        String url = storageService.store(file, "profiles");

        assertTrue(url.startsWith("/uploads/profiles/"));
        assertTrue(url.endsWith(".png"));
    }

    @Test
    void store_GIF_파일_저장_성공() {
        MockMultipartFile file = new MockMultipartFile(
                "image", "test.gif", "image/gif", new byte[1024]);

        String url = storageService.store(file, "rooms");

        assertTrue(url.startsWith("/uploads/rooms/"));
        assertTrue(url.endsWith(".gif"));
    }

    @Test
    void store_UUID_파일명_생성_확인() {
        MockMultipartFile file = new MockMultipartFile(
                "image", "original-name.jpg", "image/jpeg", new byte[1024]);

        String url = storageService.store(file, "messages");

        // UUID 형식의 파일명 사용 (원본 파일명이 아닌지 확인)
        assertFalse(url.contains("original-name"));
    }

    @Test
    void store_날짜별_디렉토리_생성_확인() {
        MockMultipartFile file = new MockMultipartFile(
                "image", "test.jpg", "image/jpeg", new byte[1024]);

        String url = storageService.store(file, "messages");

        // /uploads/messages/yyyy/MM/dd/uuid.jpg 형식 확인
        String[] parts = url.split("/");
        assertEquals("uploads", parts[1]);
        assertEquals("messages", parts[2]);
        // 연도 (4자리 숫자)
        assertTrue(parts[3].matches("\\d{4}"));
        // 월 (2자리 숫자)
        assertTrue(parts[4].matches("\\d{2}"));
        // 일 (2자리 숫자)
        assertTrue(parts[5].matches("\\d{2}"));
    }

    @Test
    void store_허용되지_않는_확장자_예외() {
        MockMultipartFile file = new MockMultipartFile(
                "image", "test.bmp", "image/bmp", new byte[1024]);

        assertThrows(IllegalArgumentException.class,
                () -> storageService.store(file, "messages"));
    }

    @Test
    void store_5MB_초과_파일_예외() {
        byte[] largeContent = new byte[6 * 1024 * 1024]; // 6MB
        MockMultipartFile file = new MockMultipartFile(
                "image", "large.jpg", "image/jpeg", largeContent);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> storageService.store(file, "messages"));
        assertTrue(ex.getMessage().contains("5MB"));
    }

    @Test
    void store_빈_파일_예외() {
        MockMultipartFile file = new MockMultipartFile(
                "image", "empty.jpg", "image/jpeg", new byte[0]);

        assertThrows(IllegalArgumentException.class,
                () -> storageService.store(file, "messages"));
    }

    @Test
    void store_null_contentType_예외() {
        MockMultipartFile file = new MockMultipartFile(
                "image", "test.jpg", null, new byte[1024]);

        assertThrows(IllegalArgumentException.class,
                () -> storageService.store(file, "messages"));
    }

    @Test
    void delete_존재하는_파일_삭제_성공() throws Exception {
        // 파일 먼저 저장
        MockMultipartFile file = new MockMultipartFile(
                "image", "test.jpg", "image/jpeg", new byte[1024]);
        String url = storageService.store(file, "messages");

        // 파일 존재 확인
        String relativePath = url.substring("/uploads/".length());
        assertTrue(Files.exists(tempDir.resolve(relativePath)));

        // 삭제
        storageService.delete(url);

        // 삭제 확인
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
