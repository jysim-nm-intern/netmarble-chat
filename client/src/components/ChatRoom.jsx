import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CreateChatRoomModal from './CreateChatRoomModal';
import ChatRoomList from './ChatRoomList';
import ChatRoomView from './ChatRoomView';
import { chatRoomService } from '../api/chatRoomService';

const TABS = [
  { key: 'all',      label: '전체' },
  { key: 'unread',   label: '안읽음' },
  { key: 'joined',   label: '참가중' },
  { key: 'notJoined', label: '참가하지 않음' },
];

function ChatRoom({ user, onLogout }) {
  const { chatRoomId } = useParams();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [selectedChatRoom, setSelectedChatRoom] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [totalUnread, setTotalUnread] = useState(0);

  // URL의 chatRoomId로 채팅방 정보 로드
  useEffect(() => {
    if (chatRoomId) {
      loadChatRoom(chatRoomId);
    }
  }, [chatRoomId]);

  const loadChatRoom = async (roomId) => {
    try {
      setLoading(true);
      const chatRoom = await chatRoomService.getChatRoomById(roomId);
      setSelectedChatRoom(chatRoom);
    } catch (err) {
      console.error('Failed to load chat room:', err);
      navigate('/', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleChatRoomCreated = (chatRoom) => {
    setRefreshKey(prev => prev + 1);
    navigate(`/chatroom/${chatRoom.id}`);
  };

  const handleSelectChatRoom = (chatRoom) => {
    navigate(`/chatroom/${chatRoom.id}`);
  };

  const handleLeaveChatRoom = () => {
    setSelectedChatRoom(null);
    setRefreshKey(prev => prev + 1);
    navigate('/', { replace: true });
  };

  // 채팅방 뷰 (내부에 자체 헤더 포함)
  if (selectedChatRoom) {
    return (
      <div className="h-screen flex flex-col">
        <ChatRoomView
          user={user}
          chatRoom={selectedChatRoom}
          onLeave={handleLeaveChatRoom}
        />
      </div>
    );
  }

  // 채팅방 목록 뷰
  return (
    <div className="h-screen flex flex-col bg-[#f5f3f0]">
      {/* 상단 헤더 */}
      <div className="bg-[#ffd54f] px-4 pt-5 pb-4 border-b border-[#ffc107]">
        <div className="flex items-center justify-between">
          {/* 프로필 아바타 + 타이틀 + 닉네임 */}
          <div className="flex items-center gap-3">
            {user.profileImage ? (
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-white/60 shadow">
                <img
                  src={user.profileImage}
                  alt={`${user.nickname} 프로필`}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="w-10 h-10 rounded-full shrink-0 ring-2 ring-white/60 shadow flex items-center justify-center text-white text-base font-bold"
                style={{ backgroundColor: user.profileColor || '#4f85c8' }}
              >
                {user.nickname?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-[#5d4037]">채팅</h1>
              <p className="text-xs text-[#8d6e63] mt-0.5">{user.nickname}</p>
            </div>
          </div>

          {/* 우측 아이콘 버튼들 */}
          <div className="flex items-center gap-1">
            {/* 새 채팅방 만들기 */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[#5d4037] hover:bg-[#ffc107]/40 transition-colors"
              aria-label="새 채팅방 만들기"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M12 8v4M10 10h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span className="text-[10px] font-medium leading-none">새 채팅방</span>
            </button>

            {/* 로그아웃 */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[#5d4037] hover:bg-[#ffc107]/40 transition-colors"
              aria-label="로그아웃"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16 17l5-5-5-5M21 12H9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[10px] font-medium leading-none">로그아웃</span>
            </button>
          </div>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                {tab.key === 'unread' && totalUnread > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-bold leading-none rounded-full bg-red-500 text-white">
                    {totalUnread > 999 ? '999+' : totalUnread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 채팅방 목록 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin h-8 w-8 text-[#5d4037]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <ChatRoomList
            key={refreshKey}
            user={user}
            filter={activeTab}
            onSelectChatRoom={handleSelectChatRoom}
            onTotalUnreadChange={setTotalUnread}
          />
        )}
      </div>

      {/* 채팅방 생성 모달 */}
      {showCreateModal && (
        <CreateChatRoomModal
          user={user}
          onClose={() => setShowCreateModal(false)}
          onChatRoomCreated={handleChatRoomCreated}
        />
      )}

      {/* 로그아웃 확인 팝업 */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-72 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 아이콘 + 메시지 영역 */}
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
                    stroke="#b45309"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 17l5-5-5-5M21 12H9"
                    stroke="#b45309"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="text-base font-bold text-gray-900 mb-1">로그아웃</h2>
              <p className="text-sm text-gray-500">정말 로그아웃 하시겠습니까?</p>
            </div>

            {/* 버튼 영역 */}
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <div className="w-px bg-gray-100" />
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="flex-1 py-3.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatRoom;
