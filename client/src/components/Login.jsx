import { useState, useRef } from 'react';
import { userService } from '../api/userService';

// 선택 가능한 프로필 아바타 색상 팔레트
const AVATAR_COLORS = [
  '#4f85c8', // 파랑
  '#e05c5c', // 빨강
  '#4caf7d', // 초록
  '#f0a030', // 주황
  '#9c6fcc', // 보라
  '#e87d9a', // 핑크
  '#38b2c4', // 청록
  '#8d9aaa', // 회색
];

function getRandomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024;

function Login({ onLoginSuccess }) {
  const [nickname, setNickname] = useState('');
  const [profileColor, setProfileColor] = useState(getRandomColor);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const validateNickname = (value) => {
    if (!value || value.trim().length < 2) {
      return '닉네임은 2자 이상이어야 합니다.';
    }
    if (value.length > 50) {
      return '닉네임은 50자 이하여야 합니다.';
    }
    if (!/^[a-zA-Z0-9가-힣_]+$/.test(value)) {
      return '닉네임은 영문, 숫자, 한글, 언더스코어만 사용할 수 있습니다.';
    }
    return '';
  };

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

    const validationError = validateNickname(nickname);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const user = await userService.createUser(nickname, profileColor, imageFile);
      localStorage.setItem('chatUser', JSON.stringify(user));
      onLoginSuccess(user);
    } catch (err) {
      console.error('Login error:', err);
      const serverError = err.response?.data;
      if (typeof serverError === 'object') {
        if (serverError.message) {
          setError(serverError.message);
        } else if (serverError.details) {
          setError(Object.values(serverError.details).join(', '));
        } else {
          setError(`서버 오류 (${err.response?.status || 500})`);
        }
      } else if (err.response?.status === 404 || err.code === 'ERR_NETWORK') {
        setError('서버(8080)에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
      } else {
        setError(err.message || '로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNicknameChange = (e) => {
    setNickname(e.target.value);
    setError('');
  };

  const avatarLetter = nickname.trim() ? nickname.trim()[0].toUpperCase() : '?';

  return (
    <div className="min-h-screen bg-[#f5f3f0] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* 카드 헤더 */}
        <div className="bg-[#ffd54f] border-b border-[#ffc107] px-6 pt-8 pb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                stroke="#5d4037"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h1 className="text-2xl font-bold text-[#5d4037]">Netmarble Chat</h1>
          </div>
          <p className="text-sm text-[#8d6e63]">닉네임을 입력하여 채팅을 시작하세요</p>
        </div>

        {/* 카드 본문 */}
        <div className="px-6 py-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* 프로필 아바타 미리보기 */}
            <div className="flex flex-col items-center gap-3">
              {/* 원형 프리뷰 */}
              <div className="relative group">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-md select-none ring-4 ring-[#ffd54f]/60 overflow-hidden cursor-pointer"
                  style={imagePreview ? {} : { backgroundColor: profileColor }}
                  onClick={() => !loading && fileInputRef.current?.click()}
                  title="클릭해서 프로필 이미지 선택"
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="프로필 이미지 미리보기"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    avatarLetter
                  )}
                </div>

                {/* 카메라 아이콘 오버레이 */}
                <div
                  className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer pointer-events-none"
                >
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>

              {/* 이미지 첨부 / 제거 버튼 */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="text-xs text-[#5d4037] border border-[#d4c5b8] rounded-full px-3 py-1 hover:bg-[#ffd54f]/30 transition-colors disabled:opacity-50"
                >
                  {imageFile ? '이미지 변경' : '프로필 이미지 선택'}
                </button>
                {imageFile && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={loading}
                    className="text-xs text-red-500 border border-red-200 rounded-full px-3 py-1 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    제거
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={handleImageChange}
                className="hidden"
                disabled={loading}
              />

              {/* 이미지 없을 때만 색상 선택 표시 */}
              {!imageFile && (
                <>
                  <p className="text-xs text-[#8d6e63] font-medium">또는 프로필 색상 선택</p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {AVATAR_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setProfileColor(color)}
                        className="w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none"
                        style={{
                          backgroundColor: color,
                          boxShadow: profileColor === color
                            ? `0 0 0 2px white, 0 0 0 4px ${color}`
                            : 'none',
                        }}
                        aria-label="색상 선택"
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileColor(getRandomColor())}
                    className="text-xs text-[#8d6e63] hover:text-[#5d4037] underline transition-colors"
                  >
                    🎲 랜덤 색상
                  </button>
                </>
              )}
            </div>

            {/* 닉네임 입력 */}
            <div>
              <label htmlFor="nickname" className="block text-sm font-semibold text-[#5d4037] mb-1.5">
                닉네임
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={handleNicknameChange}
                placeholder="닉네임을 입력하세요"
                className={`w-full px-4 py-3 border ${
                  error ? 'border-red-400' : 'border-[#e0d8d0]'
                } rounded-xl bg-[#fafaf9] focus:outline-none focus:ring-2 focus:ring-[#ffc107] focus:border-[#ffc107] transition-all text-[#5d4037] placeholder-[#b0a090]`}
                disabled={loading}
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !nickname.trim()}
              className="w-full bg-[#5d4037] text-white py-3 px-4 rounded-xl font-semibold
                       hover:bg-[#4e342e] focus:outline-none focus:ring-2 focus:ring-[#ffc107]
                       focus:ring-offset-2 disabled:bg-[#c8bdb8] disabled:cursor-not-allowed
                       transition-all transform hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
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
                  입장 중...
                </span>
              ) : (
                '채팅 시작'
              )}
            </button>
          </form>
        </div>

        {/* 카드 푸터 */}
        <div className="bg-[#fafaf9] border-t border-[#f0ebe6] px-6 py-3 text-center">
          <p className="text-xs text-[#a09080]">영문, 숫자, 한글, 언더스코어(_) · 2~50자</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
