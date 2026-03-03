import { useRef, useEffect, useMemo, useState } from 'react';

function MessageList({
  messages,
  members,
  currentUserId,
  reconnectVersion,
  highlightKeyword,
  highlightSenderName,
  jumpMessageId,
  jumpPulseKey,
  jumpDateKey,
  jumpDatePulseKey
}) {
  const containerRef = useRef(null);
  const lastMessageRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(messages.length);
  const forceScrollRef = useRef(false);
  const messageRefs = useRef(new Map());
  const dateRefs = useRef(new Map());
  const [animateDateKey, setAnimateDateKey] = useState(null);

  // senderId → member 정보 조회용 맵
  const memberMap = useMemo(() => {
    const map = new Map();
    (members || []).forEach(m => map.set(m.userId, m));
    return map;
  }, [members]);

  useEffect(() => {
    if (reconnectVersion > 0) {
      forceScrollRef.current = true;
    }
  }, [reconnectVersion]);

  useEffect(() => {
    if (!jumpDateKey) return;
    const target = dateRefs.current.get(jumpDateKey);
    if (!target || !containerRef.current) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const animTimer = setTimeout(() => setAnimateDateKey(jumpDateKey), 620);
    const clearTimer = setTimeout(() => setAnimateDateKey(null), 1600);

    return () => {
      clearTimeout(animTimer);
      clearTimeout(clearTimer);
    };
  }, [jumpDateKey, jumpDatePulseKey]);

  useEffect(() => {
    const hasNewMessages = messages.length > prevMessageCountRef.current;
    if (hasNewMessages && (forceScrollRef.current || isNearBottomRef.current)) {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
      forceScrollRef.current = false;
    } else if (!hasNewMessages && isNearBottomRef.current) {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'auto'
        });
      }
    }
    prevMessageCountRef.current = messages.length;

    console.log('[MessageList] 메시지 업데이트, 총', messages.length, '개');
    messages.forEach(msg => {
      if (msg.unreadCount !== undefined && msg.unreadCount > 0) {
        console.log('[MessageList] 메시지ID:', msg.id, ', 안읽은사람:', msg.unreadCount, '명');
      }
    });
  }, [messages]);

  useEffect(() => {
    if (!jumpMessageId) return;
    const target = messageRefs.current.get(jumpMessageId);
    if (target && containerRef.current) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [jumpMessageId, jumpPulseKey]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceToBottom < 80;
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    const h = hours % 12 || 12;
    return `${ampm} ${h}:${minutes}`;
  };

  const getLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isMyMessage = (message) => message.senderId === currentUserId;

  const isSystemMessage = (message) =>
    message.type === 'SYSTEM' || message.senderId === null;

  /**
   * 동일 송신자가 같은 '분'에 연속으로 보낸 메시지 그룹에서
   * 마지막 메시지에만 시간을 표시한다.
   */
  const shouldShowTime = (message, nextMessage) => {
    if (!nextMessage) return true;
    if (isSystemMessage(nextMessage)) return true;
    if (nextMessage.senderId !== message.senderId) return true;
    return formatTime(message.sentAt) !== formatTime(nextMessage.sentAt);
  };

  /**
   * 상대방 메시지에서 아바타·이름을 표시할지 결정한다.
   * 같은 '분' 내 동일 송신자의 첫 번째 메시지에만 표시한다.
   */
  const shouldShowAvatar = (message, prevMessage) => {
    if (!prevMessage || isSystemMessage(prevMessage)) return true;
    if (prevMessage.senderId !== message.senderId) return true;
    return formatTime(message.sentAt) !== formatTime(prevMessage.sentAt);
  };

  /**
   * 상대방 프로필 아바타 렌더링 (이미지 우선, 없으면 색상 원 + 이니셜)
   */
  const renderSenderAvatar = (senderId, nickname) => {
    const member = memberMap.get(senderId);
    const color = member?.profileColor || '#8d9aaa';

    if (member?.profileImage) {
      return (
        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-1 ring-gray-200">
          <img
            src={member.profileImage}
            alt={`${nickname} 프로필`}
            className="w-full h-full object-cover"
          />
        </div>
      );
    }
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ring-1 ring-gray-200"
        style={{ backgroundColor: color }}
      >
        {nickname?.charAt(0)?.toUpperCase() || '?'}
      </div>
    );
  };

  const highlightKeywordLower = highlightKeyword?.trim().toLowerCase();
  const highlightParts = useMemo(() => {
    if (!highlightKeywordLower) return null;
    const escaped = highlightKeywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(${escaped})`, 'gi');
  }, [highlightKeywordLower]);

  const renderHighlightedText = (text) => {
    if (!highlightParts || !highlightKeywordLower) return text;
    const parts = text.split(highlightParts);
    return parts.map((part, index) => {
      if (part.toLowerCase() === highlightKeywordLower) {
        return (
          <mark key={`${part}-${index}`} className="bg-yellow-200 text-gray-900 px-0.5 rounded">
            {part}
          </mark>
        );
      }
      return <span key={`${part}-${index}`}>{part}</span>;
    });
  };

  const renderSenderName = (nickname) => {
    if (highlightSenderName && nickname === highlightSenderName) {
      return (
        <mark className="bg-yellow-200 text-amber-800 px-0.5 rounded font-semibold not-italic">
          {nickname}
        </mark>
      );
    }
    return <span className="text-[#8d6e63]">{nickname}</span>;
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">💬</p>
          <p>아직 메시지가 없습니다</p>
          <p className="text-sm mt-1">첫 메시지를 보내보세요!</p>
        </div>
      </div>
    );
  }

  const renderedMessages = [];
  let lastDateKey = null;

  messages.forEach((message, index) => {
    const messageDate = new Date(message.sentAt);
    const dateKey = getLocalDateKey(messageDate);
    const isLastMessage = index === messages.length - 1;
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;

    // 날짜 구분선
    if (dateKey !== lastDateKey) {
      lastDateKey = dateKey;
      const isDateJumpTarget = dateKey === animateDateKey;
      const dateBounceStyle = isDateJumpTarget
        ? {
            animationName: jumpDatePulseKey % 2 === 0 ? 'message-bounce' : 'message-bounce-alt',
            animationDuration: '0.9s',
            animationTimingFunction: 'ease',
            animationDelay: '0ms',
            animationFillMode: 'both',
          }
        : undefined;
      renderedMessages.push(
        <div
          key={`date-${dateKey}`}
          ref={(node) => {
            if (node) dateRefs.current.set(dateKey, node);
            else dateRefs.current.delete(dateKey);
          }}
          className="flex justify-center my-3"
        >
          <div
            className="bg-[#ede8e3] text-[#8d6e63] text-xs px-3 py-1.5 rounded-full border border-[#c8bdb8] flex items-center gap-2"
            style={dateBounceStyle}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 2v4M16 2v4M3 9h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>{messageDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
          </div>
        </div>
      );
    }

    // 시스템 메시지
    if (isSystemMessage(message)) {
      const isJumpTarget = message.id === jumpMessageId;
      const bounceStyle = isJumpTarget
        ? {
            animationName: jumpPulseKey % 2 === 0 ? 'message-bounce' : 'message-bounce-alt',
            animationDuration: '1s',
            animationTimingFunction: 'ease',
            animationDelay: '0ms',
            animationFillMode: 'both'
          }
        : undefined;
      renderedMessages.push(
        <div
          key={message.id}
          ref={(node) => {
            if (node) messageRefs.current.set(message.id, node);
            else messageRefs.current.delete(message.id);
            if (isLastMessage) lastMessageRef.current = node;
          }}
          className="flex justify-center my-4"
        >
          <div
            className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2 rounded-lg shadow-sm"
            style={bounceStyle}
          >
            <span className="font-medium">📢 {message.content}</span>
          </div>
        </div>
      );
      return;
    }

    const isMine = isMyMessage(message);
    const unreadCount = message.unreadCount || 0;
    const isJumpTarget = message.id === jumpMessageId;
    const showTime = shouldShowTime(message, nextMessage);
    // 상대방 메시지: 같은 '분' 내 첫 번째 메시지일 때 아바타·이름 표시
    const showAvatar = !isMine && shouldShowAvatar(message, prevMessage);

    const bounceStyle = isJumpTarget
      ? {
          animationName: jumpPulseKey % 2 === 0 ? 'message-bounce' : 'message-bounce-alt',
          animationDuration: '1s',
          animationTimingFunction: 'ease',
          animationDelay: '0ms',
          animationFillMode: 'both'
        }
      : undefined;

    /**
     * 시간 + 읽지 않은 수 컬럼 (버블 외부 측면)
     */
    const sideInfo =
      showTime || unreadCount > 0 ? (
        <div
          className={`flex flex-col justify-end shrink-0 self-end mb-0.5 ${
            isMine ? 'items-end' : 'items-start'
          }`}
        >
          {unreadCount > 0 && (
            <span className="text-xs text-amber-500 font-semibold leading-none mb-0.5">
              {unreadCount}
            </span>
          )}
          {showTime && (
            <span className="text-xs text-[#a1887f] leading-none whitespace-nowrap">
              {formatTime(message.sentAt)}
            </span>
          )}
        </div>
      ) : null;

    // 스티커 메시지
    if (message.messageType === 'STICKER') {
      renderedMessages.push(
        <div
          key={message.id}
          ref={(node) => {
            if (node) messageRefs.current.set(message.id, node);
            else messageRefs.current.delete(message.id);
            if (isLastMessage) lastMessageRef.current = node;
          }}
          className={`flex ${isMine ? 'justify-end' : 'justify-start items-start gap-2'}`}
        >
          {/* 상대방: 아바타 컬럼 */}
          {!isMine && (
            <div className="w-8 shrink-0 mt-1">
              {showAvatar && renderSenderAvatar(message.senderId, message.senderNickname)}
            </div>
          )}

          <div className="max-w-xs lg:max-w-md">
            {!isMine && showAvatar && (
              <p className="text-xs mb-1 px-1">{renderSenderName(message.senderNickname)}</p>
            )}
            <div className="flex items-end gap-1.5">
              {isMine && sideInfo}
              <div
                className="text-5xl hover:scale-110 transition-transform cursor-pointer"
                style={bounceStyle}
                title={`${message.senderNickname || 'You'} sent a sticker`}
              >
                {message.attachmentUrl || message.content}
              </div>
              {!isMine && sideInfo}
            </div>
          </div>
        </div>
      );
      return;
    }

    // 이미지 메시지
    if (message.messageType === 'IMAGE') {
      renderedMessages.push(
        <div
          key={message.id}
          ref={(node) => {
            if (node) messageRefs.current.set(message.id, node);
            else messageRefs.current.delete(message.id);
            if (isLastMessage) lastMessageRef.current = node;
          }}
          className={`flex ${isMine ? 'justify-end' : 'justify-start items-start gap-2'}`}
        >
          {!isMine && (
            <div className="w-8 shrink-0 mt-1">
              {showAvatar && renderSenderAvatar(message.senderId, message.senderNickname)}
            </div>
          )}

          <div className="max-w-xs lg:max-w-md">
            {!isMine && showAvatar && (
              <p className="text-xs mb-1 px-1">{renderSenderName(message.senderNickname)}</p>
            )}
            <div className="flex items-end gap-1.5">
              {isMine && sideInfo}
              <div
                className={`rounded-lg overflow-hidden ${
                  isMine ? 'bg-[#ffd54f] rounded-br-none' : 'bg-white rounded-bl-none'
                }`}
                style={bounceStyle}
              >
                <img
                  src={message.attachmentUrl || message.content}
                  alt="사용자가 전송한 이미지"
                  className="max-w-full h-auto max-h-64 object-cover"
                  loading="eager"
                />
              </div>
              {!isMine && sideInfo}
            </div>
          </div>
        </div>
      );
      return;
    }

    // 일반 텍스트 메시지
    renderedMessages.push(
      <div
        key={message.id}
        ref={(node) => {
          if (node) messageRefs.current.set(message.id, node);
          else messageRefs.current.delete(message.id);
          if (isLastMessage) lastMessageRef.current = node;
        }}
        className={`flex ${isMine ? 'justify-end' : 'justify-start items-start gap-2'}`}
      >
        {/* 상대방: 아바타 컬럼 (항상 자리 차지, 아바타는 첫 메시지에만 렌더) */}
        {!isMine && (
          <div className="w-8 shrink-0 mt-1">
            {showAvatar && renderSenderAvatar(message.senderId, message.senderNickname)}
          </div>
        )}

        <div className="max-w-xs lg:max-w-md">
          {/* 이름: 첫 메시지에만 표시 */}
          {!isMine && showAvatar && (
            <p className="text-xs mb-1 px-1">{renderSenderName(message.senderNickname)}</p>
          )}
          <div className="flex items-end gap-1.5">
            {isMine && sideInfo}
            <div
              className={`px-4 py-2 rounded-lg ${
                isMine
                  ? 'bg-[#ffd54f] text-[#5d4037] rounded-br-none'
                  : 'bg-white text-[#5d4037] rounded-bl-none'
              }`}
              style={bounceStyle}
            >
              <p className="break-words whitespace-pre-wrap">
                {renderHighlightedText(message.content)}
              </p>
            </div>
            {!isMine && sideInfo}
          </div>
        </div>
      </div>
    );
  });

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 space-y-3"
    >
      {renderedMessages}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;
