package com.netmarble.chat.infrastructure.storage;

import com.netmarble.chat.domain.service.FileStorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 로컬 파일 시스템 기반 FileStorageService 구현체
 * 파일을 {uploadDir}/{type}/{yyyy/MM/dd}/{uuid}.{ext} 경로에 저장한다.
 */
@Slf4j
@Service
public class LocalFileStorageService implements FileStorageService {

    private static final Set<String> ALLOWED_TYPES = Set.of("profiles", "rooms", "messages");

    private static final Map<String, String> CONTENT_TYPE_TO_EXTENSION = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/gif", "gif"
    );

    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024; // 5MB
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy/MM/dd");

    private final Path uploadDir;

    public LocalFileStorageService(@Value("${file.upload-dir:/data/uploads}") String uploadDir) {
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
            log.info("파일 업로드 디렉토리 초기화: {}", this.uploadDir);
        } catch (IOException e) {
            throw new RuntimeException("업로드 디렉토리를 생성할 수 없습니다: " + this.uploadDir, e);
        }
    }

    @Override
    public String store(InputStream inputStream, String contentType, String originalFilename, long fileSize, String type) {
        validateType(type);
        validateContentType(contentType);
        validateFileSize(fileSize);

        String extension = CONTENT_TYPE_TO_EXTENSION.get(contentType);
        String datePath = LocalDate.now().format(DATE_FORMAT);
        String fileName = UUID.randomUUID() + "." + extension;

        Path targetDir = uploadDir.resolve(type).resolve(datePath).normalize();
        // 디렉토리 탈출 방지 (type 화이트리스트로 1차 차단, normalize 후 2차 검증)
        if (!targetDir.startsWith(uploadDir)) {
            throw new IllegalArgumentException("잘못된 저장 경로입니다.");
        }

        try {
            Files.createDirectories(targetDir);
        } catch (IOException e) {
            throw new RuntimeException("디렉토리 생성 실패: " + targetDir, e);
        }

        Path targetPath = targetDir.resolve(fileName);
        try {
            Files.copy(inputStream, targetPath, StandardCopyOption.REPLACE_EXISTING);
            log.info("파일 저장 완료: {}", targetPath);
        } catch (IOException e) {
            throw new RuntimeException("파일 저장 실패: " + targetPath, e);
        }

        // URL 경로 반환: /uploads/{type}/{yyyy/MM/dd}/{uuid}.{ext}
        return "/uploads/" + type + "/" + datePath + "/" + fileName;
    }

    @Override
    public void delete(String filePath) {
        if (filePath == null || filePath.isBlank()) {
            return;
        }
        // /uploads/ 접두사 제거 후 실제 파일 경로 생성
        String relativePath = filePath.startsWith("/uploads/") ? filePath.substring("/uploads/".length()) : filePath;
        Path path = uploadDir.resolve(relativePath).normalize();

        // 디렉토리 탈출 방지
        if (!path.startsWith(uploadDir)) {
            log.warn("디렉토리 탈출 시도 차단: {}", filePath);
            return;
        }

        try {
            if (Files.deleteIfExists(path)) {
                log.info("파일 삭제 완료: {}", path);
            }
        } catch (IOException e) {
            log.warn("파일 삭제 실패: {}", path, e);
        }
    }

    private void validateType(String type) {
        if (type == null || !ALLOWED_TYPES.contains(type)) {
            throw new IllegalArgumentException("허용되지 않는 저장 유형입니다: " + type);
        }
    }

    private void validateContentType(String contentType) {
        if (contentType == null || !CONTENT_TYPE_TO_EXTENSION.containsKey(contentType)) {
            throw new IllegalArgumentException("JPG, PNG, GIF 형식만 지원합니다.");
        }
    }

    private void validateFileSize(long fileSize) {
        if (fileSize <= 0) {
            throw new IllegalArgumentException("파일이 비어있습니다.");
        }
        if (fileSize > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("이미지 크기가 5MB를 초과합니다.");
        }
    }
}
