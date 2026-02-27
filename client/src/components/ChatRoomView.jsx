import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/**
 * 채팅방 헤더용 소형 아바타 그룹
 * count = 본인 제외 실제 배열 길이 기준으로 분기
 * - 1명: 단일 아바타
 * - 2명: 2개 겹침 (대각선)
 * - 3명: 3개 삼각형 배치
 * - 4명+: 4개 2×2 그리드
 */
function HeaderAvatarGroup({ activeMembers }) {
  const count = activeMembers.length;
  const COLORS = ['#8d9aaa', '#4f85c8', '#4caf7d', '#f0a030'];

  const Avatar = ({ member, index, className }) => {
    const color = member?.profileColor || COLORS[(index || 0) % 4];
    if (member?.profileImage) {
      return (
        <div className={`${className} rounded-full overflow-hidden border-2 border-[#ffd54f]`}>
          <img src={member.profileImage} alt="프로필" className="w-full h-full object-cover" />
        </div>
      );
    }
    return (
      <div
        className={`${className} rounded-full border-2 border-[#ffd54f] flex items-center justify-center text-white font-semibold`}
        style={{ backgroundColor: color }}
      >
        <span className="text-[9px] leading-none">
          {member?.nickname?.charAt(0)?.toUpperCase() || '?'}
        </span>
      </div>
    );
  };

  if (count === 0) return null;

  if (count === 1) {
    const m = activeMembers[0];
    const color = m?.profileColor || COLORS[0];
    if (m?.profileImage) {
      return (
        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-sm border-2 border-[#ffd54f]">
          <img src={m.profileImage} alt="프로필" className="w-full h-full object-cover" />
        </div>
      );
    }
    return (
      <div
        className="w-9 h-9 rounded-full shrink-0 shadow-sm flex items-center justify-center text-white text-sm font-bold"
        style={{ backgroundColor: color }}
      >
        <span>{m?.nickname?.charAt(0)?.toUpperCase() || '?'}</span>
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="relative w-9 h-9 shrink-0">
        <Avatar member={activeMembers[0]} index={0} className="absolute top-0 left-0 w-6 h-6" />
        <Avatar member={activeMembers[1]} index={1} className="absolute bottom-0 right-0 w-6 h-6" />
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="relative w-9 h-9 shrink-0">
        <Avatar member={activeMembers[0]} index={0} className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5" />
        <Avatar member={activeMembers[1]} index={1} className="absolute bottom-0 left-0 w-5 h-5" />
        <Avatar member={activeMembers[2]} index={2} className="absolute bottom-0 right-0 w-5 h-5" />
      </div>
    );
  }

  // 4명 이상: 2×2 그리드 (grid-rows-2로 각 셀 정사각형 보장)
  return (
    <div className="w-9 h-9 grid grid-cols-2 grid-rows-2 gap-0.5 shrink-0">
      {[0, 1, 2, 3].map(i => (
        <Avatar key={i} member={activeMembers[i]} index={i} className="w-full h-full rounded-full" />
      ))}
    </div>
  );
}
import { chatRoomService } from '../api/chatRoomService';
import { messageService } from '../api/messageService';
import { readStatusService } from '../api/readStatusService';
import { activityService } from '../api/activityService';
import webSocketService from '../services/WebSocketService';
import { useActivityTracking } from '../hooks/useActivityTracking';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import MessageSearch from './MessageSearch';

function ChatRoomView({ user, chatRoom, onLeave }) {
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [highlightSenderName, setHighlightSenderName] = useState('');
  const [searchResultIds, setSearchResultIds] = useState([]);
  const [currentMatchId, setCurrentMatchId] = useState(null);
  const [jumpMessageId, setJumpMessageId] = useState(null);
  const [jumpPulseKey, setJumpPulseKey] = useState(0);
  const [jumpDateKey, setJumpDateKey] = useState(null);
  const [jumpDatePulseKey, setJumpDatePulseKey] = useState(0);
  const hasActivatedRef = useRef(false);
  const wasDisconnectedRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  
  // 활성 상태 추적
  useActivityTracking(chatRoom.id, user.id, {
    onActive: () => {
      if (!hasActivatedRef.current) {
        hasActivatedRef.current = true;
        wasDisconnectedRef.current = false;
        return;
      }
      if (wasDisconnectedRef.current) {
        setReconnectVersion((prev) => prev + 1);
        wasDisconnectedRef.current = false;
      }
      connectWebSocket();
      loadMembers();
      loadMessages();
    },
    onInactive: () => {
      wasDisconnectedRef.current = true;
      webSocketService.disconnect();
      setConnected(false);
    }
  });

  // unreadCount 재계산 함수
  const recalculateUnreadCounts = useCallback((messageList, memberList) => {
    console.log('[ChatRoomView] Recalculating unreadCount for all messages');
    return messageList.map(message => {
      if (!message.senderId) {
        // 시스템 메시지는 unreadCount 없음
        return message;
      }
      
      // 이 메시지를 읽지 않은 활성 멤버 수 계산
      const unreadCount = memberList.filter(member => 
        member.active && 
        member.userId !== message.senderId && // 발신자 제외
        (!member.lastReadMessageId || member.lastReadMessageId < message.id) // 읽지 않은 경우
      ).length;
      
      return { ...message, unreadCount };
    });
  }, []);

  useEffect(() => {
    // 초기 데이터 로드
    loadMembers();
    loadMessages();
    connectWebSocket();

    // 컴포넌트 언마운트 시 정리
    return () => {
      disconnectWebSocket();
    };
  }, [chatRoom.id]);

  useEffect(() => {
    if (members.length === 0 || messages.length === 0) return;

    setMessages(prevMessages => {
      const nextMessages = recalculateUnreadCounts(prevMessages, members);
      const hasChanges = prevMessages.some((message, index) => {
        const prevUnread = message.unreadCount ?? 0;
        const nextUnread = nextMessages[index]?.unreadCount ?? 0;
        return prevUnread !== nextUnread;
      });

      return hasChanges ? nextMessages : prevMessages;
    });
  }, [members, recalculateUnreadCounts]);

  const activeMembers = useMemo(() => members.filter(m => m.active), [members]);
  // 헤더 아바타 그룹용: 현재 참여 중인 멤버 중 본인 제외
  const otherMembers = useMemo(
    () => members.filter(m => m.active && m.userId !== user.id),
    [members, user.id]
  );

  const searchResultIdSet = useMemo(() => new Set(searchResultIds), [searchResultIds]);
  const matchIds = useMemo(
    () => messages.filter((message) => searchResultIdSet.has(message.id)).map((message) => message.id),
    [messages, searchResultIdSet]
  );
  const currentMatchIndex = currentMatchId ? matchIds.indexOf(currentMatchId) : -1;
  const canNavigatePrev = currentMatchIndex > 0;
  const canNavigateNext = currentMatchIndex >= 0 && currentMatchIndex < matchIds.length - 1;

  useEffect(() => {
    if (matchIds.length === 0) {
      if (currentMatchId !== null) {
        setCurrentMatchId(null);
      }
      return;
    }

    if (!currentMatchId || !matchIds.includes(currentMatchId)) {
      setCurrentMatchId(matchIds[matchIds.length - 1]);
    }
  }, [matchIds, currentMatchId]);

  // 검색 결과 이동 시 해당 메시지에 바운스 애니메이션 적용
  useEffect(() => {
    if (!currentMatchId) return;
    setJumpMessageId(currentMatchId);
    setJumpPulseKey((prev) => prev + 1);
  }, [currentMatchId]);

  const getLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const messageDateIndex = useMemo(() => {
    const index = {};
    messages.forEach((message) => {
      if (!message.sentAt || !message.senderId || message.type === 'SYSTEM') return;
      const dateKey = getLocalDateKey(new Date(message.sentAt));
      if (!index[dateKey]) {
        index[dateKey] = message.id;
      }
    });
    return index;
  }, [messages]);

  const latestDateKey = useMemo(() => {
    const lastUserMessage = [...messages].reverse().find((message) => message.senderId && message.type !== 'SYSTEM');
    return lastUserMessage ? getLocalDateKey(new Date(lastUserMessage.sentAt)) : null;
  }, [messages]);

  const loadMembers = async () => {
    try {
      const memberList = await chatRoomService.getChatRoomMembers(chatRoom.id);
      console.log('[ChatRoomView] Members loaded:', memberList);
      setMembers(memberList);
      // 멤버 로드 완료 후 메시지 unreadCount 재계산
      if (messages.length > 0) {
        setMessages(prevMessages => recalculateUnreadCounts(prevMessages, memberList));
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  const loadMessages = async () => {
    try {
      if (isInitialLoadRef.current) {
        setLoading(true);
      }
      const messageList = await messageService.getChatRoomMessages(chatRoom.id, user.id);
      console.log('[ChatRoomView] Messages loaded:', messageList.length);
      // 멤버 정보가 있으면 unreadCount 재계산
      if (members.length > 0) {
        setMessages(recalculateUnreadCounts(messageList, members));
      } else {
        setMessages(messageList);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      if (isInitialLoadRef.current) {
        setLoading(false);
        isInitialLoadRef.current = false;
      }
    }
  };

  const connectWebSocket = async () => {
    try {
      await webSocketService.connect(
        () => {
          console.log('WebSocket connected');
          setConnected(true);
          
          // 채팅방 구독
          webSocketService.subscribeToChatRoom(chatRoom.id, handleMessageReceived);
          
          // 읽음 상태 업데이트 구독
          webSocketService.subscribeToReadStatus(chatRoom.id, handleReadStatusUpdate);
          
          // 입장 알림 (선택사항 - 서버에서 이미 처리했을 수도 있음)
          // webSocketService.notifyUserJoined(chatRoom.id, user.id, user.nickname);
        },
        (error) => {
          console.error('WebSocket connection error:', error);
          setConnected(false);
        }
      );
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setConnected(false);
    }
  };

  const handleReadStatusUpdate = (readStatusData) => {
    console.log('[ChatRoomView] 읽음 상태 업데이트 수신:', readStatusData);
    
    // 1. 멤버 정보에서 해당 사용자의 lastReadMessageId 업데이트
    setMembers(prevMembers => {
      const targetMember = prevMembers.find(member => member.userId === readStatusData.userId);
      
      // lastReadMessageId가 변경되지 않았으면 재계산 건너뜀
      if (targetMember && targetMember.lastReadMessageId === readStatusData.lastReadMessageId) {
        console.log(`[ChatRoomView] 멤버 ${targetMember.nickname}의 lastReadMessageId 변경 없음, 재계산 건너뜀`);
        return prevMembers;
      }
      
      const updatedMembers = prevMembers.map(member => {
        if (member.userId === readStatusData.userId) {
          console.log(`[ChatRoomView] 멤버 ${member.nickname}의 lastReadMessageId: ${member.lastReadMessageId} -> ${readStatusData.lastReadMessageId}`);
          return { ...member, lastReadMessageId: readStatusData.lastReadMessageId };
        }
        return member;
      });
      
      // 2. 업데이트된 멤버 정보로 모든 메시지의 unreadCount 재계산
      setMessages(prevMessages => recalculateUnreadCounts(prevMessages, updatedMembers));
      
      return updatedMembers;
    });
    
    console.log('[ChatRoomView] 읽음 상태 업데이트 완료');
  };

  const disconnectWebSocket = () => {
    webSocketService.unsubscribeFromChatRoom(chatRoom.id);
    // 전체 연결 해제는 하지 않음 (다른 채팅방으로 이동할 수 있음)
  };

  const handleMessageReceived = async (message) => {
    console.log('[ChatRoomView] New message received:', message);
    
    // 1. 메시지 목록에 추가 (서버에서 계산한 unreadCount를 그대로 사용)
    setMessages((prevMessages) => {
      const exists = prevMessages.some(m => m.id === message.id);
      if (exists) {
        console.log('[ChatRoomView] Message already exists, skipping');
        return prevMessages;
      }

      // 본인이 보낸 TEXT 메시지: Optimistic Update로 미리 추가된 temp 메시지를 실제 메시지로 교체
      if (
        message.senderId === user.id &&
        (message.type === 'TEXT' || message.messageType === 'TEXT')
      ) {
        const tempIdx = prevMessages.findIndex(
          m =>
            typeof m.id === 'string' &&
            m.id.startsWith('temp-') &&
            m.content === message.content &&
            m.senderId === message.senderId
        );
        if (tempIdx !== -1) {
          const updated = [...prevMessages];
          updated[tempIdx] = message;
          return updated;
        }
      }

      console.log('[ChatRoomView] Adding new message to list, unreadCount:', message.unreadCount);
      return [...prevMessages, message];
    });
    
    // 2. 멤버 목록 갱신 (입장/퇴장 시스템 메시지일 경우)
    if (message.type === 'SYSTEM') {
      loadMembers();
    }
    
    // 3. 다른 사용자의 메시지를 받은 경우 읽음 처리
    // (서버가 READ_STATUS_UPDATE 이벤트를 발생시켜 모든 클라이언트의 unreadCount가 자동 갱신됨)
    if (message.senderId !== user.id) {
      try {
        console.log('[ChatRoomView] 다른 사용자 메시지 수신, 읽음 처리 시작:', message.id);
        await readStatusService.markAsRead(user.id, chatRoom.id);
        console.log('[ChatRoomView] 읽음 처리 요청 완료');
      } catch (err) {
        console.error('[ChatRoomView] Failed to mark as read:', err);
      }
    } else {
      // 본인 메시지의 경우 즉시 읽음 처리
      try {
        console.log('[ChatRoomView] 본인 메시지 전송 완료:', message.id);
        await readStatusService.markAsRead(user.id, chatRoom.id);
        console.log('[ChatRoomView] 본인 메시지 읽음 처리 완료');
      } catch (err) {
        console.error('[ChatRoomView] Failed to mark as read for own message:', err);
      }
    }
  };

  const handleSendMessage = (content) => {
    if (!connected) {
      alert('WebSocket 연결이 끊어졌습니다. 페이지를 새로고침해주세요.');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      chatRoomId: chatRoom.id,
      senderId: user.id,
      senderNickname: user.nickname,
      content,
      messageType: 'TEXT',
      type: 'TEXT',
      sentAt: new Date().toISOString(),
      unreadCount: 0,
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      webSocketService.sendMessage(chatRoom.id, user.id, content);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      alert('메시지 전송에 실패했습니다.');
    }
  };

  const handleSendSticker = async (sticker) => {
    if (!connected) {
      alert('WebSocket 연결이 끊어졌습니다. 페이지를 새로고침해주세요.');
      return;
    }

    // 즉시 렌더링을 위한 임시 메시지 추가 (Optimistic Update)
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      chatRoomId: chatRoom.id,
      senderId: user.id,
      senderNickname: user.nickname,
      content: sticker,
      messageType: 'STICKER',
      sentAt: new Date().toISOString(),
      unreadCount: 0,
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      const message = await messageService.sendSticker(chatRoom.id, user.id, sticker);
      // 임시 메시지 제거 후 서버 응답으로 교체 (WebSocket이 먼저 도착한 경우 중복 방지)
      setMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempId);
        if (withoutTemp.some(m => m.id === message.id)) return withoutTemp;
        return [...withoutTemp, message];
      });
    } catch (error) {
      console.error('Failed to send sticker:', error);
      // 실패 시 임시 메시지 제거
      setMessages(prev => prev.filter(m => m.id !== tempId));
      alert('스티커 전송에 실패했습니다.');
    }
  };

  const handleSendImage = async (imageData) => {
    if (!connected) {
      alert('WebSocket 연결이 끊어졌습니다. 페이지를 새로고침해주세요.');
      return;
    }

    // 즉시 렌더링을 위한 임시 메시지 추가 (Optimistic Update)
    const tempId = `temp-${Date.now()}`;
    const localUrl = URL.createObjectURL(imageData.file);
    const tempMessage = {
      id: tempId,
      chatRoomId: chatRoom.id,
      senderId: user.id,
      senderNickname: user.nickname,
      content: localUrl,
      messageType: 'IMAGE',
      attachmentUrl: localUrl,
      sentAt: new Date().toISOString(),
      unreadCount: 0,
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      const message = await messageService.uploadImageFile(chatRoom.id, user.id, imageData.file);
      const serverImageUrl = message.attachmentUrl || message.content;

      const replaceTemp = () => {
        setMessages(prev => {
          const withoutTemp = prev.filter(m => m.id !== tempId);
          if (withoutTemp.some(m => m.id === message.id)) return withoutTemp;
          return [...withoutTemp, message];
        });
        URL.revokeObjectURL(localUrl);
      };

      if (serverImageUrl) {
        // 서버 이미지를 미리 로딩한 후 교체 → 플리커 없이 부드럽게 전환
        const preload = new window.Image();
        preload.onload = replaceTemp;
        preload.onerror = replaceTemp; // 로딩 실패해도 교체는 진행
        preload.src = serverImageUrl;
      } else {
        replaceTemp();
      }
    } catch (error) {
      console.error('Failed to send image:', error);
      // 실패 시 임시 메시지 제거 후 로컬 URL 해제
      setMessages(prev => prev.filter(m => m.id !== tempId));
      URL.revokeObjectURL(localUrl);
      alert('이미지 전송에 실패했습니다.');
    }
  };

  const handleLeave = async () => {
    try {
      await activityService.updateActiveStatus(chatRoom.id, user.id, false);
      await chatRoomService.leaveChatRoom(chatRoom.id, user.id);
      disconnectWebSocket();
      onLeave();
    } catch (err) {
      console.error('Failed to leave chat room:', err);
      alert('채팅방 퇴장에 실패했습니다.');
    }
  };
  
  const handleBack = async () => {
    // 채팅방 목록으로 돌아갈 때 비활성화 처리
    try {
      await activityService.updateActiveStatus(chatRoom.id, user.id, false);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
    disconnectWebSocket();
    onLeave();
  };

  /**
   * 검색 결과 처리
   */
  const handleSearchResults = (results, keyword, senderName) => {
    const ids = (results || []).map((message) => message.id);
    setSearchResultIds(ids);
    setSearchKeyword(keyword || '');
    setHighlightSenderName(senderName || '');
    if (ids.length === 0) {
      setCurrentMatchId(null);
    }
  };

  const handleNavigatePrev = () => {
    if (!canNavigatePrev) return;
    setCurrentMatchId(matchIds[currentMatchIndex - 1]);
  };

  const handleNavigateNext = () => {
    if (!canNavigateNext) return;
    setCurrentMatchId(matchIds[currentMatchIndex + 1]);
  };

  const handleJumpToMessage = (messageId) => {
    if (!messageId) return;
    setJumpMessageId(messageId);
    setJumpPulseKey((prev) => prev + 1);
  };

  /** 캘린더에서 날짜 선택: 검색 상태 초기화 후 해당 날짜 세퍼레이터로 스크롤 */
  const handleJumpToDate = (dateKey) => {
    if (!dateKey) return;
    setSearchKeyword('');
    setHighlightSenderName('');
    setSearchResultIds([]);
    setCurrentMatchId(null);
    setJumpDateKey(dateKey);
    setJumpDatePulseKey((prev) => prev + 1);
  };

  const handleJumpToLatest = () => {
    if (!latestDateKey) return;
    handleJumpToDate(latestDateKey);
  };

  /**
   * 검색 창 닫기
   */
  const handleCloseSearch = () => {
    setShowSearch(false);
    setSearchKeyword('');
    setHighlightSenderName('');
    setSearchResultIds([]);
    setCurrentMatchId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 채팅방 나가기 확인 팝업 */}
      {showLeaveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowLeaveConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-72 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
                    stroke="#dc2626"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 17l5-5-5-5M21 12H9"
                    stroke="#dc2626"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="text-base font-bold text-gray-900 mb-1">채팅방 나가기</h2>
              <p className="text-sm text-gray-500">정말 채팅방을 나가시겠습니까?</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <div className="w-px bg-gray-100" />
              <button
                onClick={() => {
                  setShowLeaveConfirm(false);
                  handleLeave();
                }}
                className="flex-1 py-3.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 채팅방 헤더 */}
      <div className="bg-[#ffd54f] border-b border-[#ffc107] px-4 py-3">
        <div className="flex items-center gap-2">
          {/* 왼쪽: 뒤로가기 + 채팅방 목록 레이블 */}
          <div className="shrink-0">
            <button
              onClick={handleBack}
              className="flex items-center gap-1 p-1.5 rounded-lg text-[#5d4037] hover:bg-[#ffc107]/40 transition-colors"
              aria-label="채팅방 목록으로"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-medium text-[#5d4037]">채팅방 목록</span>
            </button>
          </div>

          {/* 중앙: 아바타 그룹 + 채팅방 이름 + 참여자 수 */}
          <div className="flex-1 flex items-center justify-center gap-2 min-w-0 overflow-hidden">
            {chatRoom.imageUrl ? (
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#ffd54f] shrink-0 bg-white">
                <img src={chatRoom.imageUrl} alt={`${chatRoom.name} 채팅방 이미지`} className="w-full h-full object-cover" />
              </div>
            ) : (
              <HeaderAvatarGroup activeMembers={otherMembers.slice(0, 4)} />
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#5d4037] truncate leading-tight">
                {chatRoom.name}
              </h2>
              <p className="flex items-center gap-0.5 text-xs text-[#8d6e63] leading-tight mt-0.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                {activeMembers.length}
              </p>
            </div>
          </div>

          {/* 오른쪽: 연결 상태 + 검색 + 햄버거 */}
          <div className="flex items-center gap-1 shrink-0">
            {/* 연결 상태 표시 컴포넌트 */}
            <div className="flex flex-col items-center gap-0.5 px-1.5 py-1 w-[46px]">
              <div className="relative w-[18px] h-[18px] flex items-center justify-center">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
                />
                {connected && (
                  <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-60" />
                )}
              </div>
              <span className={`text-[9px] font-medium leading-none text-center whitespace-nowrap ${connected ? 'text-green-800' : 'text-red-700'}`}>
                {connected ? '연결됨' : '연결 끊김'}
              </span>
            </div>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg text-[#5d4037] hover:bg-[#ffc107]/40 transition-colors"
              aria-label="메시지 검색"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16.5 16.5l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span className="text-[9px] font-medium leading-none">검색</span>
            </button>
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg text-[#5d4037] hover:bg-[#ffc107]/40 transition-colors"
              aria-label="참여자 목록"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span className="text-[9px] font-medium leading-none">참여자</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 메시지 영역 */}
        <div className="flex-1 bg-[#f5f3f0] flex flex-col">
          {/* 검색 바 */}
          {showSearch && (
            <MessageSearch
              chatRoomId={chatRoom.id}
              members={members}
              messages={messages}
              messageDateIndex={messageDateIndex}
              onSearchResults={handleSearchResults}
              onClose={handleCloseSearch}
              onNavigatePrev={handleNavigatePrev}
              onNavigateNext={handleNavigateNext}
              canNavigatePrev={canNavigatePrev}
              canNavigateNext={canNavigateNext}
              currentIndex={currentMatchIndex}
              totalMatches={matchIds.length}
              onJumpToMessage={handleJumpToMessage}
              onJumpToDate={handleJumpToDate}
              onJumpToLatest={handleJumpToLatest}
            />
          )}

          {loading && messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-[#5d4037]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <>
              <MessageList
                messages={messages}
                members={members}
                currentUserId={user.id}
                reconnectVersion={reconnectVersion}
                highlightKeyword={searchKeyword}
                highlightSenderName={highlightSenderName}
                jumpMessageId={jumpMessageId}
                jumpPulseKey={jumpPulseKey}
                jumpDateKey={jumpDateKey}
                jumpDatePulseKey={jumpDatePulseKey}
              />
              <MessageInput 
                onSendMessage={handleSendMessage}
                onSendSticker={handleSendSticker}
                onSendImage={handleSendImage}
                disabled={!connected} 
              />
            </>
          )}
        </div>

        {/* 멤버 목록 사이드바 (햄버거 토글) */}
        {showSidebar && (
          <div className="w-64 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">
                참여자 ({members.length})
              </h3>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="사이드바 닫기"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {[...members]
                .sort((a, b) => {
                  if (a.userId === user.id) return -1;
                  if (b.userId === user.id) return 1;
                  return a.nickname.localeCompare(b.nickname, ['ko', 'en'], { numeric: true });
                })
                .map((member) => (
                <div
                  key={member.id}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-[#f5f3f0]"
                >
                  {/* 프로필 아바타: 이미지 우선, 없으면 색상 원 */}
                  {member.profileImage ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-1 ring-gray-200">
                      <img
                        src={member.profileImage}
                        alt={`${member.nickname} 프로필`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
                      style={{ backgroundColor: member.profileColor || '#5d4037' }}
                    >
                      {member.nickname.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {member.nickname}
                      {member.userId === user.id && (
                        <span className="ml-1 text-xs text-[#8d6e63]">(나)</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
              >
                채팅방 나가기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatRoomView;
