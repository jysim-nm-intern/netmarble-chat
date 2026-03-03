import { vi, describe, it, expect, beforeEach } from 'vitest';

let capturedConfig = null;
const mockUnsubscribe = vi.fn();
const mockSubscribe = vi.fn(() => ({ unsubscribe: mockUnsubscribe }));
const mockPublish = vi.fn();
const mockActivate = vi.fn();
const mockDeactivate = vi.fn();

vi.mock('@stomp/stompjs', () => ({
  Client: vi.fn().mockImplementation((config) => {
    capturedConfig = config;
    return {
      subscribe: mockSubscribe,
      publish: mockPublish,
      activate: mockActivate,
      deactivate: mockDeactivate,
    };
  }),
}));

vi.mock('sockjs-client', () => ({
  default: vi.fn(() => ({})),
}));

const { default: webSocketService } = await import('../../services/WebSocketService');

describe('WebSocketService', () => {
  beforeEach(() => {
    webSocketService.disconnect();
    capturedConfig = null;
    mockSubscribe.mockClear();
    mockUnsubscribe.mockClear();
    mockPublish.mockClear();
    mockActivate.mockClear();
    mockDeactivate.mockClear();
  });

  // --- 연결 상태 리스너 ---

  describe('addConnectionListener', () => {
    it('리스너를 등록하고 해제 함수를 반환한다', () => {
      const listener = vi.fn();
      const remove = webSocketService.addConnectionListener(listener);

      expect(typeof remove).toBe('function');

      remove();
      // 해제 후에는 리스너가 호출되지 않아야 함
      webSocketService._notifyConnectionChange(true);
      expect(listener).not.toHaveBeenCalled();
    });

    it('연결 상태 변경 시 등록된 리스너를 호출한다', () => {
      const listener = vi.fn();
      webSocketService.addConnectionListener(listener);

      webSocketService._notifyConnectionChange(true);
      expect(listener).toHaveBeenCalledWith(true);

      webSocketService._notifyConnectionChange(false);
      expect(listener).toHaveBeenCalledWith(false);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  // --- connect ---

  describe('connect', () => {
    it('STOMP 클라이언트를 생성하고 연결에 성공하면 isConnected=true', async () => {
      const onConnected = vi.fn();
      const promise = webSocketService.connect(onConnected);

      expect(capturedConfig).not.toBeNull();
      expect(mockActivate).toHaveBeenCalled();

      capturedConfig.onConnect({ command: 'CONNECTED' });
      await promise;

      expect(webSocketService.isConnected()).toBe(true);
      expect(onConnected).toHaveBeenCalledWith({ command: 'CONNECTED' });
    });

    it('이미 연결된 상태에서 호출하면 즉시 resolve', async () => {
      const promise1 = webSocketService.connect();
      capturedConfig.onConnect({});
      await promise1;

      const onConnected = vi.fn();
      await webSocketService.connect(onConnected);

      expect(onConnected).toHaveBeenCalled();
      expect(webSocketService.isConnected()).toBe(true);
    });

    it('연결 성공 시 등록된 리스너에 true 통보', async () => {
      const listener = vi.fn();
      webSocketService.addConnectionListener(listener);

      const promise = webSocketService.connect();
      capturedConfig.onConnect({});
      await promise;

      expect(listener).toHaveBeenCalledWith(true);
    });

    it('STOMP 에러 발생 시 reject되고 isConnected=false', async () => {
      const onError = vi.fn();
      const promise = webSocketService.connect(null, onError);

      const errorFrame = { headers: { message: 'error' } };
      capturedConfig.onStompError(errorFrame);

      await expect(promise).rejects.toBe(errorFrame);
      expect(webSocketService.isConnected()).toBe(false);
      expect(onError).toHaveBeenCalledWith(errorFrame);
    });

    it('WebSocket 에러 발생 시 reject되고 isConnected=false', async () => {
      const onError = vi.fn();
      const promise = webSocketService.connect(null, onError);

      const wsError = new Error('ws error');
      capturedConfig.onWebSocketError(wsError);

      await expect(promise).rejects.toBe(wsError);
      expect(webSocketService.isConnected()).toBe(false);
      expect(onError).toHaveBeenCalledWith(wsError);
    });

    it('disconnect 없이 재연결 시 새 Promise가 독립적으로 resolve된다', async () => {
      // 1차 연결 성공
      const promise1 = webSocketService.connect();
      capturedConfig.onConnect({});
      await promise1;

      // disconnect 없이 연결 끊김 시뮬레이션 (내부 상태만 초기화)
      webSocketService.connected = false;

      // 2차 connect() 호출 - 새 Promise가 독립적으로 동작해야 함
      const promise2 = webSocketService.connect();
      capturedConfig.onConnect({});

      await expect(promise2).resolves.toBeUndefined();
      expect(webSocketService.isConnected()).toBe(true);
    });
  });

  // --- disconnect ---

  describe('disconnect', () => {
    it('연결 해제 시 isConnected=false 및 리스너 통보', async () => {
      const promise = webSocketService.connect();
      capturedConfig.onConnect({});
      await promise;

      const listener = vi.fn();
      webSocketService.addConnectionListener(listener);

      webSocketService.disconnect();

      expect(webSocketService.isConnected()).toBe(false);
      expect(mockDeactivate).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(false);
    });

    it('기존 구독을 모두 해제한다', async () => {
      const promise = webSocketService.connect();
      capturedConfig.onConnect({});
      await promise;

      webSocketService.subscribeToChatRoom(1, vi.fn());
      webSocketService.subscribeToChatRoom(2, vi.fn());

      webSocketService.disconnect();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(2);
    });
  });

  // --- subscribeToChatRoom ---

  describe('subscribeToChatRoom', () => {
    it('연결 안 된 상태에서 null 반환', () => {
      const result = webSocketService.subscribeToChatRoom(1, vi.fn());
      expect(result).toBeNull();
    });

    it('연결 상태에서 구독 객체 반환', async () => {
      const promise = webSocketService.connect();
      capturedConfig.onConnect({});
      await promise;

      const callback = vi.fn();
      const sub = webSocketService.subscribeToChatRoom(1, callback);

      expect(sub).not.toBeNull();
      expect(mockSubscribe).toHaveBeenCalledWith(
        '/topic/chatroom/1',
        expect.any(Function)
      );
    });

    it('이미 구독 중인 방이면 기존 구독을 해제하고 재구독', async () => {
      const promise = webSocketService.connect();
      capturedConfig.onConnect({});
      await promise;

      webSocketService.subscribeToChatRoom(1, vi.fn());
      webSocketService.subscribeToChatRoom(1, vi.fn());

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribe).toHaveBeenCalledTimes(2);
    });

    it('메시지 수신 시 콜백이 파싱된 데이터로 호출된다', async () => {
      const promise = webSocketService.connect();
      capturedConfig.onConnect({});
      await promise;

      const callback = vi.fn();
      webSocketService.subscribeToChatRoom(1, callback);

      const stompCallback = mockSubscribe.mock.calls[0][1];
      const messageData = { id: 1, content: '안녕', senderId: 2 };
      stompCallback({ body: JSON.stringify(messageData) });

      expect(callback).toHaveBeenCalledWith(messageData);
    });
  });

  // --- unsubscribeFromChatRoom ---

  describe('unsubscribeFromChatRoom', () => {
    it('구독된 방의 메시지 구독과 읽음 상태 구독을 모두 해제', async () => {
      const promise = webSocketService.connect();
      capturedConfig.onConnect({});
      await promise;

      webSocketService.subscribeToChatRoom(1, vi.fn());
      webSocketService.subscribeToReadStatus(1, vi.fn());

      webSocketService.unsubscribeFromChatRoom(1);

      expect(mockUnsubscribe).toHaveBeenCalledTimes(2);
    });

    it('구독 없는 방에 대해 호출해도 오류 없음', () => {
      expect(() => webSocketService.unsubscribeFromChatRoom(999)).not.toThrow();
    });
  });

  // --- sendMessage ---

  describe('sendMessage', () => {
    it('연결 안 된 상태에서 예외 발생', () => {
      expect(() => webSocketService.sendMessage(1, '안녕')).toThrow(
        'WebSocket is not connected'
      );
    });

    it('연결 상태에서 메시지를 publish한다 (senderId 없이)', async () => {
      const promise = webSocketService.connect();
      capturedConfig.onConnect({});
      await promise;

      webSocketService.sendMessage(1, '안녕하세요', 'TEXT');

      expect(mockPublish).toHaveBeenCalledWith({
        destination: '/app/chat.sendMessage',
        body: JSON.stringify({
          chatRoomId: 1,
          content: '안녕하세요',
          type: 'TEXT',
        }),
      });
    });
  });

  // --- notifyUserJoined ---

  describe('notifyUserJoined', () => {
    it('연결 상태에서 입장 알림을 publish한다', async () => {
      const promise = webSocketService.connect();
      capturedConfig.onConnect({});
      await promise;

      webSocketService.notifyUserJoined(1, '테스터');

      expect(mockPublish).toHaveBeenCalledWith({
        destination: '/app/chat.addUser',
        body: JSON.stringify({
          chatRoomId: 1,
          content: '테스터님이 입장했습니다.',
          type: 'SYSTEM',
        }),
      });
    });
  });

  // --- isConnected ---

  describe('isConnected', () => {
    it('초기 상태는 false', () => {
      expect(webSocketService.isConnected()).toBe(false);
    });

    it('연결 후 true, 해제 후 false', async () => {
      const promise = webSocketService.connect();
      capturedConfig.onConnect({});
      await promise;

      expect(webSocketService.isConnected()).toBe(true);

      webSocketService.disconnect();

      expect(webSocketService.isConnected()).toBe(false);
    });
  });
});
