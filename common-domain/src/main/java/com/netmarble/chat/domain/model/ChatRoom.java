package com.netmarble.chat.domain.model;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * 채팅방 도메인 모델 (순수 POJO - 인프라 의존 없음)
 */
@Getter
@NoArgsConstructor
public class ChatRoom {

    private Long id;
    private String name;
    private String imageUrl;
    private LocalDateTime createdAt;
    private Long creatorId;
    private boolean active;
    private List<ChatRoomMember> members = new ArrayList<>();

    public ChatRoom(String name, String imageUrl, User creator) {
        validateName(name);
        this.name = name;
        this.imageUrl = imageUrl;
        this.creatorId = creator.getId();
        this.createdAt = LocalDateTime.now();
        this.active = true;
    }

    public ChatRoom(Long id, String name, String imageUrl, Long creatorId,
                    LocalDateTime createdAt, boolean active, List<ChatRoomMember> members) {
        this.id = id;
        this.name = name;
        this.imageUrl = imageUrl;
        this.creatorId = creatorId;
        this.createdAt = createdAt;
        this.active = active;
        this.members = members != null ? members : new ArrayList<>();
    }

    private void validateName(String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("채팅방 이름은 비어있을 수 없습니다.");
        }
        if (name.length() < 2 || name.length() > 100) {
            throw new IllegalArgumentException("채팅방 이름은 2자 이상 100자 이하여야 합니다.");
        }
    }

    public boolean addMember(User user) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("유효한 사용자(ID 포함)가 필요합니다.");
        }

        boolean alreadyActiveMember = members.stream()
            .anyMatch(m -> Objects.equals(m.getUserId(), user.getId()) && m.isActive());

        if (alreadyActiveMember) {
            return false;
        }

        ChatRoomMember inactiveMember = members.stream()
            .filter(m -> Objects.equals(m.getUserId(), user.getId()) && !m.isActive())
            .findFirst()
            .orElse(null);

        if (inactiveMember != null) {
            inactiveMember.rejoin();
            return true;
        } else {
            // chatRoomId는 ChatRoom이 저장된 뒤 인프라 계층에서 채워진다
            members.add(new ChatRoomMember(user.getId()));
            return true;
        }
    }

    public void removeMember(User user) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("유효한 사용자(ID 포함)가 필요합니다.");
        }

        ChatRoomMember member = members.stream()
            .filter(m -> Objects.equals(m.getUserId(), user.getId()) && m.isActive())
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("채팅방에 참여하지 않은 사용자입니다."));

        member.leave();
    }

    public long getActiveMemberCount() {
        return members.stream().filter(ChatRoomMember::isActive).count();
    }

    public boolean isActiveMember(User user) {
        if (user == null || user.getId() == null) {
            return false;
        }
        return members.stream()
            .anyMatch(m -> Objects.equals(m.getUserId(), user.getId()) && m.isActive());
    }

    public void deactivate() {
        this.active = false;
    }

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
