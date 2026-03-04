package com.netmarble.chat.domain.service;

import java.io.InputStream;

/**
 * 파일 저장소 인터페이스
 * DDD 원칙에 따라 도메인 레이어에 인터페이스를 정의하고,
 * 인프라 레이어에서 구현체를 제공한다.
 * 프레임워크(Spring) 타입에 의존하지 않고 순수 Java 타입만 사용한다.
 */
public interface FileStorageService {

    /**
     * 파일을 저장하고 접근 URL을 반환한다.
     *
     * @param inputStream 파일 데이터 스트림
     * @param contentType MIME 타입 (예: image/jpeg)
     * @param originalFilename 원본 파일명
     * @param fileSize 파일 크기 (bytes)
     * @param type 저장 유형 (profiles, rooms, messages)
     * @return 저장된 파일의 접근 URL (예: /uploads/messages/2026/03/04/uuid.jpg)
     */
    String store(InputStream inputStream, String contentType, String originalFilename, long fileSize, String type);

    /**
     * 저장된 파일을 삭제한다.
     *
     * @param filePath 파일 접근 URL
     */
    void delete(String filePath);
}
