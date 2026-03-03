import { useEffect, useRef } from 'react';
import { activityService } from '../api/activityService';
import { readStatusService } from '../api/readStatusService';

/**
 * 사용자 활성 상태 추적 훅
 * - Visibility API로 화면 표시 여부 감지
 * - 일정 시간마다 하트비트 전송
 * - 마우스/키보드 활동 감지
 * - 채팅방 입장 시 즉시 읽음 처리
 */
export function useActivityTracking(chatRoomId, userId, options = {}) {
  const activityTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const inactiveDelayRef = useRef(null);
  const isActiveRef = useRef(false); // 현재 로컬 상태 추적용

  useEffect(() => {
    if (!chatRoomId || !userId) return;

    const clearInactiveDelay = () => {
      if (inactiveDelayRef.current) {
        clearTimeout(inactiveDelayRef.current);
        inactiveDelayRef.current = null;
      }
    };

    const scheduleInactive = () => {
      if (inactiveDelayRef.current) return;
      inactiveDelayRef.current = setTimeout(() => {
        inactiveDelayRef.current = null;
        setInactive();
      }, 3000);
    };

    // 비활성화 통합 함수
    const setInactive = () => {
      if (!isActiveRef.current) return; // 이미 비활성 상태면 중단
      isActiveRef.current = false;
      console.log('[Activity] 비활성 상태 전환 (최소화/탭전환/유휴)');
      activityService.updateActiveStatus(chatRoomId, userId, false);
      if (options.onInactive) {
        options.onInactive();
      }
    };

    // 활성화 통합 함수
    const setActive = async () => {
      if (isActiveRef.current) return; // 이미 활성 상태면 중단
      clearInactiveDelay();
      isActiveRef.current = true;
      console.log('[Activity] 활성 상태 전환');
      
      await activityService.updateActiveStatus(chatRoomId, userId, true);
      await readStatusService.markAsRead(userId, chatRoomId);
      if (options.onActive) {
        options.onActive();
      }
      resetIdleTimer(); // 활성화 시 타이머 재설정
    };

    // 30초 유휴 상태 체크 (안 움직일 때)
    const resetIdleTimer = () => {
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
      
      // 만약 현재 비활성 상태인데 움직임이 감지되면 활성으로 전환
      if (!isActiveRef.current && !document.hidden) {
        setActive();
      }

      activityTimeoutRef.current = setTimeout(() => {
        setInactive();
      }, 30000); // 30초
    };

    // 브라우저 상태 감지 (최소화, 탭 전환)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setInactive();
      } else {
        setActive();
      }
    };

    // 윈도우 포커스 감지 (다른 앱 사용 시)
    const handleWindowBlur = () => scheduleInactive();
    const handleWindowFocus = () => setActive();

    // 이벤트 리스너 등록
    const activityEvents = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    activityEvents.forEach(event => window.addEventListener(event, resetIdleTimer));

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('beforeunload', setInactive); // 브라우저 닫기 직전

    // 하트비트 (생존 신고)
    heartbeatIntervalRef.current = setInterval(() => {
      if (isActiveRef.current) {
        activityService.sendHeartbeat(chatRoomId, userId);
      }
    }, 15000);

    // 초기 실행
    setActive();

    return () => {
      clearInactiveDelay();
      setInactive();
      activityEvents.forEach(event => window.removeEventListener(event, resetIdleTimer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('beforeunload', setInactive);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
    };
  }, [chatRoomId, userId]);
}