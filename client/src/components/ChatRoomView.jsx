/**
 * ChatRoomView 컴포넌트 (구현 예정 - SPEC-MSG-001 ~ 003)
 * 실시간 STOMP 메시지 송수신, 이미지/스티커 전송, 읽음 처리
 * 현재는 채팅방 화면 진입용 플레이스홀더입니다.
 */
function ChatRoomView({ user, chatRoom, onLeave }) {
  return (
    <div className="h-screen flex flex-col bg-[#f5f3f0]">
      {/* 채팅방 헤더 */}
      <div className="bg-[#ffd54f] px-4 py-3 border-b border-[#ffc107] flex items-center gap-3">
        <button
          onClick={onLeave}
          className="text-[#5d4037] hover:text-[#3e2723] font-medium text-sm"
        >
          ← 채팅방 목록
        </button>
        <h2 className="text-base font-bold text-[#5d4037] truncate">{chatRoom?.name}</h2>
      </div>

      {/* 메시지 영역 (구현 예정) */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-[#8d6e63]">
          <p className="text-lg font-medium mb-1">{chatRoom?.name}</p>
          <p className="text-sm">메시지 기능 구현 예정 (SPEC-MSG-001)</p>
        </div>
      </div>
    </div>
  );
}

export default ChatRoomView;
