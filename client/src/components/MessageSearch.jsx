import { useState, useMemo, useEffect, useRef } from 'react';
import { messageService } from '../api/messageService';

/**
 * 메시지 검색 컴포넌트
 * 채팅방 내의 메시지를 검색하고 결과를 표시합니다.
 */
function MessageSearch({
  chatRoomId,
  members,
  messages,
  messageDateIndex,
  onSearchResults,
  onClose,
  onNavigatePrev,
  onNavigateNext,
  canNavigatePrev,
  canNavigateNext,
  currentIndex,
  totalMatches,
  onJumpToMessage,
  onJumpToDate,
  onJumpToLatest
}) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [edgeNotice, setEdgeNotice] = useState(null);
  const [selectedSenderId, setSelectedSenderId] = useState('all');
  const onSearchResultsRef = useRef(onSearchResults);
  const hasHadActiveModeRef = useRef(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSenderDropdownOpen, setIsSenderDropdownOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const calendarRef = useRef(null);
  const senderDropdownRef = useRef(null);

  const getLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const activeDateKeys = useMemo(
    () => new Set(Object.keys(messageDateIndex || {})),
    [messageDateIndex]
  );

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    return Array.from({ length: 42 }, (_, index) => {
      const dayNumber = index - startWeekday + 1;
      let date = null;
      let inMonth = true;

      if (dayNumber <= 0) {
        date = new Date(year, month - 1, daysInPrevMonth + dayNumber);
        inMonth = false;
      } else if (dayNumber > daysInMonth) {
        date = new Date(year, month + 1, dayNumber - daysInMonth);
        inMonth = false;
      } else {
        date = new Date(year, month, dayNumber);
      }

      const dateKey = getLocalDateKey(date);
      const isActive = inMonth && activeDateKeys.has(dateKey);

      return { date, dateKey, inMonth, isActive };
    });
  }, [calendarMonth, activeDateKeys]);

  const filteredResults = useMemo(() => {
    const withoutSystem = searchResults.filter(
      (message) => message.senderId && message.type !== 'SYSTEM'
    );
    if (selectedSenderId === 'all') {
      return withoutSystem;
    }
    return withoutSystem.filter((message) => String(message.senderId) === selectedSenderId);
  }, [searchResults, selectedSenderId]);

  /** 키워드 검색 없이 발신자만 선택했을 때, 로드된 메시지에서 직접 필터링 */
  const senderOnlyResults = useMemo(() => {
    if (selectedSenderId === 'all') return [];
    return (messages || []).filter(
      (msg) => msg.senderId && msg.type !== 'SYSTEM' && String(msg.senderId) === selectedSenderId
    );
  }, [selectedSenderId, messages]);

  /** 현재 활성 모드 및 표시할 결과 */
  const isSenderOnlyMode = !hasSearched && selectedSenderId !== 'all';
  const hasActiveMode = hasSearched || isSenderOnlyMode;
  const activeResults = hasSearched ? filteredResults : (isSenderOnlyMode ? senderOnlyResults : []);

  const selectedSenderName = useMemo(() => {
    if (selectedSenderId === 'all') return null;
    return members?.find((m) => String(m.userId) === selectedSenderId)?.nickname ?? null;
  }, [selectedSenderId, members]);

  useEffect(() => {
    onSearchResultsRef.current = onSearchResults;
  }, [onSearchResults]);

  useEffect(() => {
    if (!onSearchResultsRef.current) return;
    if (hasSearched) {
      hasHadActiveModeRef.current = true;
      onSearchResultsRef.current(filteredResults || [], searchKeyword.trim(), selectedSenderName);
    } else if (selectedSenderId !== 'all') {
      hasHadActiveModeRef.current = true;
      onSearchResultsRef.current(senderOnlyResults, '', selectedSenderName);
    } else if (hasHadActiveModeRef.current) {
      hasHadActiveModeRef.current = false;
      onSearchResultsRef.current([], '', null);
    }
  }, [filteredResults, senderOnlyResults, hasSearched, searchKeyword, selectedSenderName, selectedSenderId]);

  /* 캘린더 외부 클릭 닫기 */
  useEffect(() => {
    if (!isCalendarOpen) return;
    const handleClickOutside = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCalendarOpen]);

  /* 인물 드롭다운 외부 클릭 닫기 */
  useEffect(() => {
    if (!isSenderDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (senderDropdownRef.current && !senderDropdownRef.current.contains(e.target)) {
        setIsSenderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSenderDropdownOpen]);

  /**
   * 메시지 검색 수행
   */
  const handleSearch = async (e) => {
    e.preventDefault();

    if (!searchKeyword.trim()) {
      // 발신자 필터가 선택된 경우 키워드 없이 발신자 단독 필터링 모드로 전환
      if (selectedSenderId !== 'all') {
        setError(null);
        setHasSearched(false);
        setSearchResults([]);
        setEdgeNotice(null);
        return;
      }
      setError('검색어를 입력해주세요.');
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const results = await messageService.searchMessages(chatRoomId, searchKeyword.trim());
      setSearchResults(results || []);
      setEdgeNotice(null);
    } catch (err) {
      console.error('검색 중 오류 발생:', err);
      setError('메시지 검색 중 오류가 발생했습니다.');
      setSearchResults([]);
      setEdgeNotice(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeywordChange = (e) => {
    setSearchKeyword(e.target.value);
    setError(null);
  };

  const handleClearKeyword = () => {
    setSearchKeyword('');
    setError(null);
  };

  const handleSenderSelect = (senderId) => {
    setSelectedSenderId(senderId);
    setIsSenderDropdownOpen(false);
    setEdgeNotice(null);
  };

  const handleCalendarPrev = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleCalendarNext = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectDate = (dateKey) => {
    if (!messageDateIndex?.[dateKey]) return;
    setIsCalendarOpen(false);
    // 날짜 선택 시 키워드 및 발신자 필터 모두 초기화
    setSearchKeyword('');
    setError(null);
    setHasSearched(false);
    setSearchResults([]);
    setSelectedSenderId('all');
    setEdgeNotice(null);
    hasHadActiveModeRef.current = false;
    onSearchResultsRef.current?.([], '', null);
    // 날짜 세퍼레이터로 이동 (캘린더 전용 콜백)
    onJumpToDate?.(dateKey);
  };

  const handleJumpToLatest = () => {
    onJumpToLatest?.();
    setIsCalendarOpen(false);
  };

  const handleNavigatePrev = () => {
    if (!hasActiveMode || totalMatches === 0) return;
    if (!canNavigatePrev) return;
    setEdgeNotice(null);
    onNavigatePrev?.();
  };

  const handleNavigateNext = () => {
    if (!hasActiveMode || totalMatches === 0) return;
    if (!canNavigateNext) return;
    setEdgeNotice(null);
    onNavigateNext?.();
  };

  /** 결과 자체가 없음 */
  const isNavDisabled = !hasActiveMode || totalMatches === 0;
  /** 방향별 이동 가능 여부 */
  const isPrevActive = !isNavDisabled && canNavigatePrev;
  const isNextActive = !isNavDisabled && canNavigateNext;

  const navBtnClass = (isActive, isDisabled) => {
    if (isDisabled) {
      // 결과 없음: 매우 흐리게
      return 'text-gray-300 opacity-50 cursor-not-allowed';
    }
    if (!isActive) {
      // 방향 끝에 도달: 중간 밝기 (결과는 있지만 이 방향은 끝)
      return 'text-gray-400 cursor-not-allowed';
    }
    // 이동 가능: 앱 테마 색상 + hover 배경
    return 'text-[#5d4037] bg-[#ffd54f]/20 hover:bg-[#ffd54f]/50 cursor-pointer';
  };

  return (
    <div className="bg-white border-b border-gray-200">
      {/* 메인 검색 바 행 */}
      <div className="flex items-center gap-1 px-3 py-2">
        {/* 검색 입력 바 (pill 형태) */}
        <form onSubmit={handleSearch} className="flex-1 min-w-0">
          <div className="flex items-center rounded-full border border-gray-300 bg-white px-3 py-1.5 gap-1.5 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400 transition-shadow">
            {/* 돋보기 아이콘 */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="text-gray-400 shrink-0"
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M16.5 16.5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>

            {/* 인물 칩 (선택된 경우만) */}
            {selectedSenderId !== 'all' && selectedSenderName && (
              <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 whitespace-nowrap shrink-0">
                {selectedSenderName}
                <button
                  type="button"
                  onClick={() => handleSenderSelect('all')}
                  className="ml-0.5 text-amber-600 hover:text-amber-900 leading-none"
                  aria-label="인물 필터 해제"
                >
                  ×
                </button>
              </span>
            )}

            {/* 검색어 입력 */}
            <input
              type="text"
              value={searchKeyword}
              onChange={handleKeywordChange}
              placeholder="검색..."
              maxLength="255"
              className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder-gray-400"
              disabled={isSearching}
            />

            {/* 검색어 초기화 버튼 */}
            {searchKeyword && (
              <button
                type="button"
                onClick={handleClearKeyword}
                className="text-gray-400 hover:text-gray-600 shrink-0 leading-none"
                aria-label="검색어 지우기"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </form>

        {/* 이전 결과 (↑) */}
        <button
          type="button"
          onClick={handleNavigatePrev}
          disabled={isNavDisabled}
          className={`p-1.5 rounded-lg transition-colors ${navBtnClass(isPrevActive, isNavDisabled)}`}
          aria-label="이전 검색 결과"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            strokeWidth={isPrevActive ? '2.2' : '1.5'}
          >
            <path
              d="M18 15l-6-6-6 6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* 다음 결과 (↓) */}
        <button
          type="button"
          onClick={handleNavigateNext}
          disabled={isNavDisabled}
          className={`p-1.5 rounded-lg transition-colors ${navBtnClass(isNextActive, isNavDisabled)}`}
          aria-label="다음 검색 결과"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            strokeWidth={isNextActive ? '2.2' : '1.5'}
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* 날짜 검색 버튼 (📅🔍) */}
        <div className="relative" ref={calendarRef}>
          <button
            type="button"
            onClick={() => {
              setIsCalendarOpen((prev) => !prev);
              setIsSenderDropdownOpen(false);
            }}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="날짜로 이동"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M8 2v4M16 2v4M3 9h18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="18" cy="18" r="3.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M21 21l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* 캘린더 팝업 */}
          {isCalendarOpen && (
            <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white shadow-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCalendarPrev}
                    className="p-1 rounded hover:bg-gray-100"
                    aria-label="이전 달"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M15 18l-6-6 6-6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <span className="text-sm font-semibold text-gray-800">
                    {calendarMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
                  </span>
                  <button
                    type="button"
                    onClick={handleCalendarNext}
                    className="p-1 rounded hover:bg-gray-100"
                    aria-label="다음 달"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M9 6l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleJumpToLatest}
                  className="text-xs px-2 py-1 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  최근
                </button>
              </div>
              <div className="grid grid-cols-7 text-[11px] text-gray-500 mb-1">
                {['일', '월', '화', '수', '목', '금', '토'].map((label) => (
                  <div key={label} className="text-center py-1">
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-sm">
                {calendarDays.map((day, index) => (
                  <button
                    key={`${day.dateKey}-${index}`}
                    type="button"
                    onClick={() => handleSelectDate(day.dateKey)}
                    disabled={!day.isActive}
                    className={`h-9 rounded-lg text-sm transition-colors ${
                      !day.inMonth
                        ? 'text-gray-300'
                        : day.isActive
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : 'text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {day.date.getDate()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 인물 검색 버튼 (👤🔍) */}
        <div className="relative" ref={senderDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setIsSenderDropdownOpen((prev) => !prev);
              setIsCalendarOpen(false);
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              selectedSenderId !== 'all'
                ? 'text-[#5d4037] bg-[#ffd54f]/30 hover:bg-[#ffd54f]/50'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            aria-label="인물 검색"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 13.5c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4Zm0 0c-3.31 0-6 2.02-6 4.5v1h9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="18" cy="18" r="3.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M21 21l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* 인물 드롭다운 */}
          {isSenderDropdownOpen && (
            <div className="absolute right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-lg z-20 w-40 py-1 max-h-52 overflow-y-auto">
              <button
                type="button"
                onClick={() => handleSenderSelect('all')}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  selectedSenderId === 'all'
                    ? 'font-semibold text-[#5d4037]'
                    : 'text-gray-700'
                }`}
              >
                전체
              </button>
              {members?.map((member) => (
                <button
                  key={member.userId}
                  type="button"
                  onClick={() => handleSenderSelect(String(member.userId))}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    selectedSenderId === String(member.userId)
                      ? 'font-semibold text-[#5d4037]'
                      : 'text-gray-700'
                  }`}
                >
                  {member.nickname}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 닫기 버튼 (✕) */}
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="검색 닫기"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* 오류 / 검색 결과 정보 행 */}
      {(error || hasActiveMode) && (
        <div className="px-4 pb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {error && <span className="text-red-600">{error}</span>}
          {hasActiveMode && !isSearching && !error && (
            <span className="text-gray-500">
              {activeResults.length === 0
                ? '검색 결과 없음'
                : totalMatches > 0 && currentIndex >= 0
                  ? `${currentIndex + 1} / ${totalMatches}건`
                  : `${activeResults.length}건`}
            </span>
          )}
          {isSearching && (
            <span className="flex items-center gap-1.5 text-gray-400">
              <svg
                className="animate-spin h-4 w-4 text-[#5d4037]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              검색 중...
            </span>
          )}
          {edgeNotice && !isSearching && (
            <span className="text-yellow-700">{edgeNotice}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default MessageSearch;
