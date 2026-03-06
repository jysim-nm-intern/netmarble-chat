import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MessageApplicationService } from '../../application/service/message-application.service.js';
import { StompBrokerService } from '../../infrastructure/config/stomp-broker.service.js';
import { SendMessageRequest } from '../../application/dto/index.js';
import { MessageType } from '../../domain/model/message.js';

/**
 * STOMP 메시지 게이트웨이
 *
 * Spring @MessageMapping 대체:
 * - /app/chat.sendMessage → 메시지 전송 + 브로드캐스트
 * - /app/chat.addUser     → 사용자 입장 알림
 */
@Injectable()
export class WebSocketMessageGateway implements OnModuleInit {
  private readonly logger = new Logger(WebSocketMessageGateway.name);

  constructor(
    private readonly messageService: MessageApplicationService,
    private readonly stompBroker: StompBrokerService,
  ) {}

  onModuleInit(): void {
    this.stompBroker.onMessage(
      '/app/chat.sendMessage',
      (body, _headers) => void this.handleSendMessage(body),
    );

    this.stompBroker.onMessage(
      '/app/chat.addUser',
      (body, _headers) => void this.handleAddUser(body),
    );
  }

  private async handleSendMessage(body: string): Promise<void> {
    try {
      const data = JSON.parse(body);
      const request = new SendMessageRequest();
      request.chatRoomId = data.chatRoomId;
      request.senderId = data.senderId;
      request.content = data.content;
      request.messageType = data.type || data.messageType;
      request.fileName = data.fileName;
      request.convertMessageType();

      const response = await this.messageService.sendMessage(request);

      this.stompBroker.send(
        `/topic/chatroom.${request.chatRoomId}`,
        JSON.stringify(response),
      );

      this.logger.log(
        `메시지 브로드캐스트: /topic/chatroom.${request.chatRoomId}`,
      );
    } catch (error) {
      this.logger.error('메시지 전송 오류', error);
    }
  }

  private async handleAddUser(body: string): Promise<void> {
    try {
      const data = JSON.parse(body);
      const request = new SendMessageRequest();
      request.chatRoomId = data.chatRoomId;
      request.senderId = data.senderId;
      request.content = data.content;
      request.messageType = data.type || data.messageType || 'SYSTEM';
      request.convertMessageType();

      const response = await this.messageService.sendMessage(request);

      this.stompBroker.send(
        `/topic/chatroom.${request.chatRoomId}`,
        JSON.stringify(response),
      );
    } catch (error) {
      this.logger.error('사용자 입장 처리 오류', error);
    }
  }
}
