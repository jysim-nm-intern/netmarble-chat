import { useState, useEffect, useRef } from 'react';
import { chatRoomService } from '../api/chatRoomService';
import webSocketService from '../services/WebSocketService';

const FALLBACK_COLORS = ['#8d9aaa', '#4f85c8', '#4caf7d', '#f0a030'];

/**
 * 단일 아바타 렌더링 헬퍼 (이미지 우선 / 없으면 색상 원 + 닉네임 첫 글자)
 */
function SingleAvatar({ avatar, index, className }) {
  const color = avatar?.profileColor || FALLBACK_COLORS[index % 4];
  if (avatar?.profileImage) {
    return (
      <div className={`${className} rounded-full overflow-hidden border-2 border-white`}>
        <img src={avatar.profileImage} alt="프로필" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`${className} rounded-full border-2 border-white flex items-center justify-center text-white font-semibold`}
      style={{ backgroundColor: color }}
    >
      <span className="text-[10px] leading-none">
        {avatar?.nickname?.charAt(0)?.toUpperCase() || '?'}
      </span>
    </div>
  );
}

/**
 * 아바타 배열 길이에 따라 겹치는 아바타 그룹을 렌더링
 * - 1명: 단일 아바타
 * - 2명: 2개 겹침 (대각선)
 * - 3명: 3개 삼각형 배치
 * - 4명+: 4개 2×2 그리드
 */
function AvatarGroup({ memberCount, avatars }) {
  const safeAvatars = Array.isArray(avatars) && avatars.length > 0 ? avatars : [];
  const count = safeAvatars.length;
  const a = (i) => safeAvatars[i] || null;
  const firstColor = a(0)?.profileColor || FALLBACK_COLORS[0];

  if (count === 0) {
    return (
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: firstColor }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="1.5" />
          <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (count === 1) {
    if (a(0)?.profileImage) {
      return (
        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-white shadow-sm">
          <img src={a(0).profileImage} alt="프로필" className="w-full h-full object-cover" />
        </div>
      );
    }
    return (
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
        style={{ backgroundColor: firstColor }}
      >
        <span>{a(0)?.nickname?.charAt(0)?.toUpperCase() || '?'}</span>
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="relative w-12 h-12 shrink-0">
        <SingleAvatar avatar={a(0)} index={0} className="absolute top-0 left-0 w-8 h-8" />
        <SingleAvatar avatar={a(1)} index={1} className="absolute bottom-0 right-0 w-8 h-8" />
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="relative w-12 h-12 shrink-0">
        <SingleAvatar avatar={a(0)} index={0} className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-7" />
        <SingleAvatar avatar={a(1)} index={1} className="absolute bottom-0 left-0 w-7 h-7" />
        <SingleAvatar avatar={a(2)} index={2} className="absolute bottom-0 right-0 w-7 h-7" />
      </div>
    );
  }

  // 4명 이상: 2×2 그리드 (grid-rows-2로 각 셀 정사각형 보장)
  return (
    <div className="w-12 h-12 grid grid-cols-2 grid-rows-2 gap-0.5 shrink-0">
      {[0, 1, 2, 3].map(i => (
        <SingleAvatar key={i} avatar={a(i)} index={i} className="w-full h-full rounded-full" />
      ))}
    </div>
  );
}

/**
 * 채팅방 목록 컴포넌트
 * filter: 'all' | 'unread' | 'joined' | 'notJoined'
 */
function ChatRoomList({ user, filter = 'all', onSelectChatRoom, onTotalUnreadChange }) {
  const [chatRooms, setChatRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const subscriptionsRef = useRef(new Map());

  useEffect(() => {
    loadChatRooms();
  }, []);

  const loadChatRooms = async () => {
    try {
      setLoading(true);
      const rooms = await chatRoomService.getAllActiveChatRooms(user.id);
      setChatRooms(rooms);
      setError('');
    } catch (err) {
      console.error('Failed to load chat rooms:', err);
      setError('채팅방 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 참가중인 방들의 총 읽지 않은 메시지 수를 부모로 전달
  useEffect(() => {
    if (!onTotalUnreadChange) return;
    const total = chatRooms
      .filter(r => r.isMember)
      .reduce((sum, r) => sum + (r.unreadCount || 0), 0);
    onTotalUnreadChange(total);
  }, [chatRooms, onTotalUnreadChange]);

  // 참가중인 방에 WebSocket 구독 → 실시간 마지막 메시지 & 읽지 않은 수 업데이트
  useEffect(() => {
    if (chatRooms.length === 0) return;

    const joinedRooms = chatRooms.filter(r => r.isMember);

    joinedRooms.forEach(room => {
      if (subscriptionsRef.current.has(room.id)) return;

      const sub = webSocketService.subscribeToChatRoom(room.id, (message) => {
        setChatRooms(prev => prev.map(r => {
          if (r.id !== room.id) return r;
          const isOwnMessage = message.senderId === user.id;
          const content = message.content?.startsWith('data:image') ? '[사진]' : message.content;
          return {
            ...r,
            lastMessageContent: content,
            lastMessageAt: message.sentAt || new Date().toISOString(),
            unreadCount: isOwnMessage ? (r.unreadCount || 0) : (r.unreadCount || 0) + 1,
          };
        }));
      });

      if (sub) subscriptionsRef.current.set(room.id, sub);
    });

    return () => {
      subscriptionsRef.current.forEach(sub => {
        try { sub.unsubscribe(); } catch (_) {}
      });
      subscriptionsRef.current.clear();
    };
  // chatRooms의 id 목록이 바뀔 때만 재구독
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatRooms.map(r => r.id).join(','), user.id]);

  const handleJoinRoom = async (chatRoom) => {
    try {
      await chatRoomService.joinChatRoom(chatRoom.id, user.id);
      onSelectChatRoom(chatRoom);
    } catch (err) {
      console.error('Failed to join chat room:', err);
      alert(err.message || '채팅방 입장에 실패했습니다.');
    }
  };

  /**
   * 오전/오후 H:MM (오늘) 또는 M월 D일 형식
   */
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (isToday) {
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? '오후' : '오전';
      return `${ampm} ${hours % 12 || 12}:${minutes}`;
    }
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  const filteredRooms = chatRooms.filter(room => {
    const joined = !!room.isMember;
    const unread = (room.unreadCount || 0) > 0;

    switch (filter) {
      case 'unread':    return joined && unread;
      case 'joined':    return joined;
      case 'notJoined': return !joined;
      default:          return true;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin h-8 w-8 text-[#5d4037]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-4 bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={loadChatRooms} className="mt-2 text-sm text-red-700 underline hover:text-red-800">
          다시 시도
        </button>
      </div>
    );
  }

  if (filteredRooms.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <svg className="mx-auto h-12 w-12 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-sm font-medium">채팅방이 없습니다</p>
        {filter === 'all' && <p className="text-xs mt-1">첫 번째 채팅방을 만들어보세요!</p>}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 bg-white">
      {filteredRooms.map((room) => {
        const joined = !!room.isMember;
        const unreadCount = joined ? (room.unreadCount || 0) : 0;
        const lastTime = joined ? formatTime(room.lastMessageAt) : '';
        const preview = joined ? (room.lastMessageContent || '') : '';

        return (
          <div
            key={room.id}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#f5f3f0] transition-colors cursor-pointer active:bg-[#ede8e3]"
            onClick={() => handleJoinRoom(room)}
          >
            {/* 채팅방 썸네일 - 이미지가 있으면 이미지, 없으면 아바타 그룹 */}
            {room.imageUrl ? (
              <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-gray-200">
                <img
                  src={room.imageUrl}
                  alt={`${room.name} 채팅방 이미지`}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <AvatarGroup
                memberCount={room.memberCount || 0}
                avatars={
                  (room.memberAvatars?.length > 0)
                    ? room.memberAvatars
                    : (room.memberCount === 1)
                      ? [{ profileImage: user.profileImage, profileColor: user.profileColor, nickname: user.nickname }]
                      : []
                }
              />
            )}

            {/* 채팅방 정보 */}
            <div className="flex-1 min-w-0">
              {/* 상단: 이름 + 인원 + 뱃지 + 시간 */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {room.name}
                </span>

                {/* 인원수 (사람 아이콘 포함) */}
                {room.memberCount > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-gray-400 shrink-0">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    {room.memberCount}
                  </span>
                )}

                {/* 참가중 뱃지 */}
                {joined ? (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200 shrink-0">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    참가중
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400 text-white shrink-0">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    참가하기
                  </span>
                )}

                {lastTime && (
                  <span className="ml-auto text-xs text-gray-400 shrink-0">{lastTime}</span>
                )}
              </div>

              {/* 하단: 마지막 메시지 + 읽지 않은 수 */}
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 truncate flex-1">{preview}</p>
                {unreadCount > 0 && (
                  <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-bold leading-none rounded-full bg-red-500 text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ChatRoomList;
