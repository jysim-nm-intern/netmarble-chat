import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

/**
 * WebSocket 연결 관리 클래스
 * - 싱글톤으로 앱 전체에서 하나의 연결을 공유
 * - 연결 상태 변경을 리스너로 전파
 */
class WebSocketService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscriptions = new Map();
    this._connectionListeners = new Set();
    this._initialResolved = false;
  }

  /**
   * 연결 상태 변경 리스너 등록.
   * 콜백은 (connected: boolean) 형태로 호출됨.
   * 반환값: 리스너 해제 함수
   */
  addConnectionListener(listener) {
    this._connectionListeners.add(listener);
    return () => this._connectionListeners.delete(listener);
  }

  _notifyConnectionChange(connected) {
    this._connectionListeners.forEach(fn => fn(connected));
  }

  /**
   * WebSocket 연결
   */
  connect(onConnected, onError) {
    if (this.connected) {
      console.log('Already connected to WebSocket');
      if (onConnected) onConnected();
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.client = new Client({
        webSocketFactory: () => new SockJS('/ws'),
        debug: (str) => {
          console.log('STOMP Debug:', str);
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: (frame) => {
          console.log('Connected to WebSocket:', frame);
          this.connected = true;
          this._notifyConnectionChange(true);
          if (onConnected) onConnected(frame);
          if (!this._initialResolved) {
            this._initialResolved = true;
            resolve();
          }
        },
        onStompError: (frame) => {
          console.error('STOMP Error:', frame);
          this.connected = false;
          this._notifyConnectionChange(false);
          if (onError) onError(frame);
          if (!this._initialResolved) {
            this._initialResolved = true;
            reject(frame);
          }
        },
        onWebSocketError: (error) => {
          console.error('WebSocket Error:', error);
          this.connected = false;
          this._notifyConnectionChange(false);
          if (onError) onError(error);
          if (!this._initialResolved) {
            this._initialResolved = true;
            reject(error);
          }
        },
        onDisconnect: () => {
          console.log('Disconnected from WebSocket');
          this.connected = false;
          this._notifyConnectionChange(false);
        }
      });

      this.client.activate();
    });
  }

  /**
   * WebSocket 연결 해제
   */
  disconnect() {
    if (this.client) {
      this.subscriptions.forEach((subscription) => {
        try { subscription.unsubscribe(); } catch (_) { /* no-op */ }
      });
      this.subscriptions.clear();

      this.client.deactivate();
      this.connected = false;
      this._initialResolved = false;
      this._notifyConnectionChange(false);
      console.log('Disconnected from WebSocket');
    }
  }

  /**
   * 채팅방 구독
   */
  subscribeToChatRoom(chatRoomId, onMessageReceived) {
    if (!this.client || !this.connected) {
      console.error('Not connected to WebSocket');
      return null;
    }

    const destination = `/topic/chatroom/${chatRoomId}`;
    
    // 이미 구독 중이면 기존 구독 취소
    if (this.subscriptions.has(destination)) {
      this.subscriptions.get(destination).unsubscribe();
    }

    const subscription = this.client.subscribe(destination, (message) => {
      try {
        const messageData = JSON.parse(message.body);
        console.log('Message received:', messageData);
        if (onMessageReceived) {
          onMessageReceived(messageData);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    this.subscriptions.set(destination, subscription);
    console.log('Subscribed to:', destination);

    return subscription;
  }

  /**
   * 채팅방 구독 취소
   */
  unsubscribeFromChatRoom(chatRoomId) {
    const destination = `/topic/chatroom/${chatRoomId}`;
    const subscription = this.subscriptions.get(destination);
    
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(destination);
      console.log('Unsubscribed from:', destination);
    }
    
    // 읽음 상태 구독도 취소
    const readStatusDestination = `/topic/chatroom/${chatRoomId}/read-status`;
    const readStatusSubscription = this.subscriptions.get(readStatusDestination);
    
    if (readStatusSubscription) {
      readStatusSubscription.unsubscribe();
      this.subscriptions.delete(readStatusDestination);
      console.log('Unsubscribed from:', readStatusDestination);
    }
  }

  /**
   * 채팅방 읽음 상태 업데이트 구독
   */
  subscribeToReadStatus(chatRoomId, onReadStatusUpdate) {
    if (!this.client || !this.connected) {
      console.error('Not connected to WebSocket');
      return null;
    }

    const destination = `/topic/chatroom/${chatRoomId}/read-status`;
    
    // 이미 구독 중이면 기존 구독 취소
    if (this.subscriptions.has(destination)) {
      this.subscriptions.get(destination).unsubscribe();
    }

    const subscription = this.client.subscribe(destination, (message) => {
      try {
        const readStatusData = JSON.parse(message.body);
        console.log('[READ STATUS] 읽음 상태 업데이트 수신:', readStatusData);
        if (onReadStatusUpdate) {
          onReadStatusUpdate(readStatusData);
        }
      } catch (error) {
        console.error('Error parsing read status update:', error);
      }
    });

    this.subscriptions.set(destination, subscription);
    console.log('Subscribed to read status:', destination);

    return subscription;
  }

  /**
   * 메시지 전송
   */
  sendMessage(chatRoomId, senderId, content, type = 'TEXT') {
    if (!this.client || !this.connected) {
      console.error('Not connected to WebSocket');
      throw new Error('WebSocket is not connected');
    }

    const message = {
      chatRoomId,
      senderId,
      content,
      type
    };

    this.client.publish({
      destination: '/app/chat.sendMessage',
      body: JSON.stringify(message)
    });

    console.log('Message sent:', message);
  }

  /**
   * 사용자 입장 알림
   */
  notifyUserJoined(chatRoomId, senderId, nickname) {
    if (!this.client || !this.connected) {
      console.error('Not connected to WebSocket');
      return;
    }

    const message = {
      chatRoomId,
      senderId,
      content: `${nickname}님이 입장했습니다.`,
      type: 'SYSTEM'
    };

    this.client.publish({
      destination: '/app/chat.addUser',
      body: JSON.stringify(message)
    });

    console.log('User joined notification sent:', message);
  }

  /**
   * 연결 상태 확인
   */
  isConnected() {
    return this.connected;
  }
}

// 싱글톤 인스턴스
const webSocketService = new WebSocketService();

export default webSocketService;
