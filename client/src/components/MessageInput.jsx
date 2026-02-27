import { useState } from 'react';

function MessageInput({ onSendMessage, onSendSticker, onSendImage, disabled }) {
  const [message, setMessage] = useState('');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 스티커 팩 정의
  const stickerPacks = {
    emoji: {
      name: '이모지 스티커',
      stickers: ['😍', '😂', '😢', '😡', '😴', '🤔', '🥰', '🎉', '👍', '👎', '❤️', '🔥']
    },
    animal: {
      name: '동물 스티커',
      stickers: ['🐶', '🐱', '🐻', '🐼', '🐨', '🐯', '🦁', '🐰', '🦊', '🐮', '🐷', '🐸']
    },
    hand: {
      name: '손짓 스티커',
      stickers: ['👋', '👍', '👏', '🤝', '👏', '🙌', '🤲', '👐', '🙏', '💪', '✌️', '🤟']
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleStickerSelect = (sticker) => {
    onSendSticker(sticker);
    setShowStickerPicker(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 검증 (5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert('파일 크기가 5MB를 초과합니다.');
      return;
    }

    // 파일 형식 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('JPG, PNG, GIF 형식만 지원합니다.');
      return;
    }

    setIsUploading(true);
    try {
      onSendImage({
        name: file.name,
        size: file.size,
        type: file.type,
        file: file
      });
      setIsUploading(false);
      if (e.target) {
        e.target.value = '';
      }
    } catch (error) {
      alert('이미지 업로드에 실패했습니다.');
      setIsUploading(false);
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* 스티커 선택 팝업 */}
      {showStickerPicker && (
        <div className="border-b border-gray-200 bg-gray-50 p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-700">스티커 선택</h3>
            <button
              onClick={() => setShowStickerPicker(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3">
            {Object.entries(stickerPacks).map(([key, pack]) => (
              <div key={key}>
                <p className="text-sm font-medium text-gray-600 mb-2">{pack.name}</p>
                <div className="grid grid-cols-12 gap-2">
                  {pack.stickers.map((sticker, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleStickerSelect(sticker)}
                      className="text-2xl hover:bg-white p-2 rounded transition-colors"
                    >
                      {sticker}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 메시지 입력 영역 — 단일 행 */}
      <form onSubmit={handleSubmit} className="flex items-end gap-1 px-3 py-2">
        {/* 이미지 첨부 버튼 */}
        <label className="shrink-0">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={disabled || isUploading}
            className="hidden"
          />
          <button
            type="button"
            onClick={(e) => e.currentTarget.parentElement.querySelector('input').click()}
            disabled={disabled || isUploading}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="이미지 첨부"
            aria-label="이미지 첨부"
          >
            {isUploading ? (
              <svg className="animate-spin w-5 h-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M3 15l5-5 4 4 3-3 6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </label>

        {/* 텍스트 입력 */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? '연결 중...' : '메시지를 입력하세요'}
          disabled={disabled || isUploading}
          rows="1"
          className="flex-1 px-3 py-2 text-sm bg-[#f5f3f0] border border-[#ede8e3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffc107] focus:border-[#ffc107] resize-none disabled:bg-gray-100 transition-shadow"
          style={{ minHeight: '38px', maxHeight: '120px' }}
        />

        {/* 전송 버튼 */}
        <button
          type="submit"
          disabled={disabled || !message.trim() || isUploading}
          className="shrink-0 p-2 rounded-lg text-[#5d4037] hover:bg-[#ffd54f]/30 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
          title="전송"
          aria-label="전송"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M22 2L11 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M22 2L15 22 11 13 2 9l20-7z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* 스티커 버튼 */}
        <button
          type="button"
          onClick={() => setShowStickerPicker(!showStickerPicker)}
          disabled={disabled || isUploading}
          className={`shrink-0 p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            showStickerPicker
              ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          }`}
          title="스티커"
          aria-label="스티커"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M8 14s1.5 2 4 2 4-2 4-2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="9" cy="10" r="1" fill="currentColor" />
            <circle cx="15" cy="10" r="1" fill="currentColor" />
          </svg>
        </button>
      </form>
    </div>
  );
}

export default MessageInput;
