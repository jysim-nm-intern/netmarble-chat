import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import ChatRoom from './components/ChatRoom'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 로컬 스토리지에서 사용자 정보 복원
  useEffect(() => {
    const savedUser = localStorage.getItem('chatUser')
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser)
        setUser(parsedUser)
      } catch (error) {
        console.error('Failed to parse saved user:', error)
        localStorage.removeItem('chatUser')
      }
    }
    setLoading(false)
  }, [])

  // 로그인 성공 시
  const handleLoginSuccess = (userData) => {
    setUser(userData)
  }

  // 로그아웃
  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('chatUser')
  }

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <svg 
            className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // 라우팅
  return (
    <Routes>
      <Route path="/login" element={
        !user ? <Login onLoginSuccess={handleLoginSuccess} /> : <Navigate to="/" replace />
      } />
      <Route path="/chatroom/:chatRoomId" element={
        user ? <ChatRoom user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
      } />
      <Route path="/" element={
        user ? <ChatRoom user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
      } />
    </Routes>
  )
}

export default App
