package com.netmarble.chat.infrastructure.persistence;

import com.netmarble.chat.domain.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * JPA를 사용한 UserRepository 구현체
 * Infrastructure 계층에서 Domain 계층의 인터페이스를 구현
 */
@Repository
public interface JpaUserRepository extends JpaRepository<User, Long>, com.netmarble.chat.domain.repository.UserRepository {
    
    @Override
    Optional<User> findByNickname(String nickname);
    
    @Override
    @Query("SELECT u FROM User u WHERE u.active = true")
    List<User> findAllActiveUsers();
    
    @Override
    boolean existsByNickname(String nickname);
}
