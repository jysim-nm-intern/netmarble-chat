import { useState, useRef } from 'react';

function CreateChatRoomModal({ user, onClose, onChatRoomCreated }) {
  const [name, setName] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
  const MAX_SIZE = 5 * 1024 * 1024;

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('JPG, PNG, GIF 형식만 지원합니다.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SIZE) {
      alert('이미지 크기가 5MB를 초과합니다.');
      e.target.value = '';
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (name.trim().length < 2) {
      setError('채팅방 이름은 2자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    try {
      const { chatRoomService } = await import('../api/chatRoomService');
      const chatRoom = await chatRoomService.createChatRoom(name, user.id, imageFile);
      onChatRoomCreated(chatRoom);
      onClose();
    } catch (err) {
      console.error('Create chat room error:', err);
      setError(err.message || '채팅방 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">새 채팅방 만들기</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 채팅방 이미지 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              채팅방 이미지 (선택)
            </label>
            <div className="flex items-center gap-4">
              {/* 미리보기 영역 */}
              <div
                className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0 cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => !loading && fileInputRef.current?.click()}
                title="이미지 선택"
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="채팅방 이미지 미리보기"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {imageFile ? '이미지 변경' : '이미지 선택'}
                </button>
                {imageFile && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={loading}
                    className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    제거
                  </button>
                )}
                {imageFile && (
                  <span className="text-xs text-gray-400 truncate max-w-[160px]">{imageFile.name}</span>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              id="chatRoomImage"
              type="file"
              accept="image/jpeg,image/png,image/gif"
              onChange={handleImageChange}
              className="hidden"
              disabled={loading}
            />
          </div>

          {/* 채팅방 이름 */}
          <div>
            <label htmlFor="chatRoomName" className="block text-sm font-medium text-gray-700 mb-2">
              채팅방 이름 *
            </label>
            <input
              id="chatRoomName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="채팅방 이름을 입력하세요"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          )}

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || name.trim().length < 2}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateChatRoomModal;
