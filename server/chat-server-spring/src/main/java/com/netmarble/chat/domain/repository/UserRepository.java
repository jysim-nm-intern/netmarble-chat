package com.netmarble.chat.domain.repository;

import com.netmarble.chat.domain.model.User;

import java.util.List;
import java.util.Optional;

/**
 * User 도메인 리포지토리 인터페이스
 * Infrastructure Layer에서 구현됨 (DDD 원칙)
 */
public interface UserRepository {
    
    User save(User user);
    
    Optional<User> findById(Long id);
    
    Optional<User> findByNickname(String nickname);
    
    List<User> findAllActiveUsers();
    
    boolean existsByNickname(String nickname);
    
    void delete(User user);
}
