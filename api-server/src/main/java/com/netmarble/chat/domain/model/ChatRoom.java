package com.netmarble.chat.domain.model;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "chat_rooms")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "MEDIUMTEXT")
    private String imageUrl;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creator_id", nullable = false)
    private User creator;

    @Version
    private Long version;

    @Column(nullable = false)
    private boolean active;

    @OneToMany(mappedBy = "chatRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ChatRoomMember> members = new ArrayList<>();

    // 비즈니스 로직을 위한 생성자
    public ChatRoom(String name, String imageUrl, User creator) {
        validateName(name);
        this.name = name;
        this.imageUrl = imageUrl;
        this.creator = creator;
        this.createdAt = LocalDateTime.now();
        this.active = true;
        
        // 생성자를 자동으로 멤버로 추가
        addMember(creator);
    }

    // 도메인 로직: 채팅방 이름 유효성 검증
    private void validateName(String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("채팅방 이름은 비어있을 수 없습니다.");
        }
        if (name.length() < 2 || name.length() > 100) {
            throw new IllegalArgumentException("채팅방 이름은 2자 이상 100자 이하여야 합니다.");
        }
    }

    // 도메인 로직: 멤버 추가
    public boolean addMember(User user) {
        // 이미 활성 멤버인지 확인
        boolean alreadyActiveMember = members.stream()
            .anyMatch(m -> m.getUser().getId().equals(user.getId()) && m.isActive());
        
        if (alreadyActiveMember) {
            // 이미 활성 멤버면 false 반환 (중복 입장)
            return false;
        }
        
        // 비활성 멤버가 있는지 확인 (재입장)
        ChatRoomMember inactiveMember = members.stream()
            .filter(m -> m.getUser().getId().equals(user.getId()) && !m.isActive())
            .findFirst()
            .orElse(null);
        
        if (inactiveMember != null) {
            // 재입장
            inactiveMember.rejoin();
            return true;
        } else {
            // 새로운 멤버 추가
            ChatRoomMember member = new ChatRoomMember(this, user);
            members.add(member);
            return true;
        }
    }

    // 도메인 로직: 멤버 제거 (퇴장)
    public void removeMember(User user) {
        ChatRoomMember member = members.stream()
            .filter(m -> m.getUser().getId().equals(user.getId()) && m.isActive())
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("채팅방에 참여하지 않은 사용자입니다."));
        
        member.leave();
    }

    // 도메인 로직: 활성 멤버 수 조회
    public long getActiveMemberCount() {
        return members.stream()
            .filter(ChatRoomMember::isActive)
            .count();
    }

    // 도메인 로직: 사용자가 활성 멤버인지 확인
    public boolean isActiveMember(User user) {
        return members.stream()
            .anyMatch(m -> m.getUser().getId().equals(user.getId()) && m.isActive());
    }

    // 도메인 로직: 채팅방 비활성화
    public void deactivate() {
        this.active = false;
    }

    // 도메인 로직: 채팅방 정보 수정
    public void updateInfo(String name, String imageUrl) {
        if (name != null) {
            validateName(name);
            this.name = name;
        }
        if (imageUrl != null) {
            this.imageUrl = imageUrl;
        }
    }
}
