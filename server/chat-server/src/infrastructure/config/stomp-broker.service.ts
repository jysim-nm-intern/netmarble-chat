import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sockjs from 'sockjs';
import { createServer, Server as HttpServer, IncomingMessage } from 'http';
import { connect as amqpConnect } from 'amqplib';
import { WebSocketServer, WebSocket } from 'ws';
import type { Duplex } from 'stream';

interface StompFrame {
  command: string;
  headers: Record<string, string>;
  body: string;
}

/** SockJS Connection과 raw WebSocket을 통합하는 인터페이스 */
interface StompConnection {
  readonly readyState: number;
  write(data: string): void;
  close(): void;
  on(event: string, handler: (...args: any[]) => void): void;
}

/** raw WebSocket을 StompConnection으로 래핑 */
class RawWsAdapter implements StompConnection {
  constructor(private readonly ws: WebSocket) {}
  get readyState(): number { return this.ws.readyState; }
  write(data: string): void { if (this.ws.readyState === WebSocket.OPEN) this.ws.send(data); }
  close(): void { this.ws.close(); }
  on(event: string, handler: (...args: any[]) => void): void {
    if (event === 'data') {
      this.ws.on('message', (msg: Buffer) => handler(msg.toString()));
    } else {
      this.ws.on(event, handler);
    }
  }
}

interface Subscription {
  id: string;
  destination: string;
  conn: StompConnection;
}

/**
 * STOMP 브로커 서비스
 *
 * Spring SimpleBroker / StompBrokerRelay 대체:
 * - /topic, /queue 구독 관리
 * - /app 접두어 메시지 라우팅
 * - SockJS 프로토콜 지원 (/ws)
 * - RABBITMQ_HOST 설정 시 RabbitMQ AMQP relay 활성화 (크로스 인스턴스 메시지 전달)
 */
@Injectable()
export class StompBrokerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StompBrokerService.name);
  private sockjsServer!: sockjs.Server;
  private rawWss: WebSocketServer | null = null;
  private httpServer: HttpServer | null = null;
  private subscriptions: Subscription[] = [];
  private messageHandlers = new Map<
    string,
    (body: string, headers: Record<string, string>) => void
  >();

  // RabbitMQ relay
  private amqpConnection: Awaited<ReturnType<typeof amqpConnect>> | null = null;
  private amqpChannel: Awaited<
    ReturnType<Awaited<ReturnType<typeof amqpConnect>>['createChannel']>
  > | null = null;
  private relayEnabled = false;
  private readonly EXCHANGE_NAME = 'stomp.broadcast';

  constructor(private readonly configService: ConfigService) {
    // SockJS 서버를 생성자에서 초기화 (main.ts에서 installHandlers 호출 전에 준비)
    this.sockjsServer = sockjs.createServer({
      log: (severity, message) => {
        if (severity === 'error') {
          this.logger.error(`[SockJS] ${message}`);
        }
      },
    });

    this.sockjsServer.on('connection', (conn) => {
      if (conn) {
        this.handleConnection(conn);
      }
    });
  }

  async onModuleInit(): Promise<void> {
    const wsPort = this.configService.get<number>('WS_PORT', 0);
    if (wsPort > 0) {
      this.httpServer = createServer();
      this.sockjsServer.installHandlers(this.httpServer, { prefix: '/ws' });
      this.httpServer.listen(wsPort, () => {
        this.logger.log(`STOMP SockJS 서버 시작: port=${wsPort}`);
      });
    } else {
      this.logger.log(
        'STOMP SockJS 서버 초기화 완료 (installHandlers 대기 중)',
      );
    }

    // RabbitMQ relay 초기화
    const rabbitmqHost = this.configService.get<string>('RABBITMQ_HOST');
    if (rabbitmqHost) {
      await this.connectToRabbitMQ();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.httpServer?.close();
    try {
      await this.amqpChannel?.close();
      await this.amqpConnection?.close();
    } catch {
      // 종료 시 연결 이미 끊긴 경우 무시
    }
  }

  /** NestJS HTTP 서버에 SockJS + Raw WebSocket 핸들러 설치 */
  installHandlers(server: HttpServer): void {
    this.sockjsServer.installHandlers(server, { prefix: '/ws' });

    // k6 부하테스트 호환: /ws-stomp 경로에 raw WebSocket 지원
    this.rawWss = new WebSocketServer({ noServer: true });
    this.rawWss.on('connection', (ws: WebSocket) => {
      this.handleConnection(new RawWsAdapter(ws));
    });
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      if (req.url === '/ws-stomp' && this.rawWss) {
        this.rawWss.handleUpgrade(req, socket, head, (ws) => {
          this.rawWss!.emit('connection', ws, req);
        });
      }
    });

    this.logger.log('SockJS + Raw WebSocket 핸들러 설치됨 (prefix: /ws, /ws-stomp)');
  }

  /** /app/* 경로 메시지 핸들러 등록 */
  onMessage(
    destination: string,
    handler: (body: string, headers: Record<string, string>) => void,
  ): void {
    this.messageHandlers.set(destination, handler);
  }

  /** 특정 destination으로 메시지 전송 (SimpMessagingTemplate.convertAndSend 대체) */
  send(destination: string, body: string): void {
    if (this.relayEnabled && this.amqpChannel) {
      // RabbitMQ relay: 모든 인스턴스에 fanout broadcast
      this.amqpChannel.publish(
        this.EXCHANGE_NAME,
        '',
        Buffer.from(body),
        { headers: { destination } },
      );
    } else {
      // 인메모리: 로컬 구독자에게만 전송
      this.deliverToLocalSubscribers(destination, body);
    }
  }

  /** RabbitMQ AMQP 연결 및 fanout exchange 설정 */
  private async connectToRabbitMQ(): Promise<void> {
    const host = this.configService.get<string>('RABBITMQ_HOST');
    const user = this.configService.get<string>('RABBITMQ_USER', 'guest');
    const pass = this.configService.get<string>('RABBITMQ_PASS', 'guest');
    const instanceId = this.configService.get<string>(
      'INSTANCE_ID',
      `node-${process.pid}`,
    );

    try {
      const conn = await amqpConnect(
        `amqp://${user}:${pass}@${host}:5672`,
      );
      this.amqpConnection = conn;
      const ch = await conn.createChannel();
      this.amqpChannel = ch;

      // fanout exchange: 모든 바인딩된 큐에 메시지 복사
      await ch.assertExchange(this.EXCHANGE_NAME, 'fanout', {
        durable: false,
      });

      // 인스턴스별 고유 큐 (exclusive: 연결 종료 시 자동 삭제)
      const { queue } = await ch.assertQueue('', {
        exclusive: true,
      });
      await ch.bindQueue(queue, this.EXCHANGE_NAME, '');

      // RabbitMQ에서 메시지 수신 → 로컬 WebSocket 구독자에게 전달
      await ch.consume(queue, (msg) => {
        if (msg) {
          const destination = msg.properties.headers?.destination as string;
          const body = msg.content.toString();
          if (destination) {
            this.deliverToLocalSubscribers(destination, body);
          }
          ch.ack(msg);
        }
      });

      this.relayEnabled = true;
      this.logger.log(
        `RabbitMQ AMQP relay 연결 성공: ${host}:5672 (instance: ${instanceId})`,
      );

      // 연결 끊김 시 in-memory 모드로 fallback
      conn.on('close', () => {
        this.logger.warn(
          'RabbitMQ 연결 끊김 — 인메모리 모드로 전환',
        );
        this.relayEnabled = false;
        this.amqpChannel = null;
        this.amqpConnection = null;
      });
    } catch (error) {
      this.logger.warn(
        `RabbitMQ 연결 실패 — 인메모리 모드로 동작: ${error}`,
      );
      this.relayEnabled = false;
    }
  }

  /** 로컬 WebSocket 구독자에게 메시지 전송 */
  private deliverToLocalSubscribers(
    destination: string,
    body: string,
  ): void {
    const matching = this.subscriptions.filter(
      (s) => s.destination === destination,
    );
    for (const sub of matching) {
      if (sub.conn.readyState === 1) {
        const msg = this.buildFrame(
          'MESSAGE',
          {
            subscription: sub.id,
            destination,
            'message-id': `msg-${Date.now()}`,
            'content-type': 'application/json',
          },
          body,
        );
        sub.conn.write(msg);
      }
    }
  }

  private handleConnection(conn: StompConnection): void {
    this.logger.log('새 SockJS 연결');
    conn.on('data', (raw: string) => {
      const frames = this.parseFrames(raw);

      for (const frame of frames) {
        switch (frame.command) {
          case 'CONNECT':
          case 'STOMP':
            conn.write(
              this.buildFrame('CONNECTED', {
                version: '1.2',
                'heart-beat': '0,0',
              }),
            );
            break;

          case 'SUBSCRIBE': {
            const subId = frame.headers['id'] ?? `sub-${Date.now()}`;
            const dest = frame.headers['destination'];
            if (dest) {
              this.subscriptions.push({
                id: subId,
                destination: dest,
                conn,
              });
              this.logger.log(`SUBSCRIBE: dest=${dest}`);
            }
            break;
          }

          case 'UNSUBSCRIBE': {
            const unsubId = frame.headers['id'];
            this.subscriptions = this.subscriptions.filter(
              (s) => !(s.id === unsubId && s.conn === conn),
            );
            break;
          }

          case 'SEND': {
            const sendDest = frame.headers['destination'];
            if (sendDest) {
              const handler = this.messageHandlers.get(sendDest);
              if (handler) {
                handler(frame.body, frame.headers);
              }
            }
            break;
          }

          case 'DISCONNECT':
            this.removeSubscriptions(conn);
            conn.close();
            break;

          default:
            break;
        }
      }
    });

    conn.on('close', () => {
      this.removeSubscriptions(conn);
    });
  }

  private removeSubscriptions(conn: StompConnection): void {
    this.subscriptions = this.subscriptions.filter((s) => s.conn !== conn);
  }

  private parseFrames(raw: string): StompFrame[] {
    const frames: StompFrame[] = [];
    const parts = raw.split('\0').filter((p) => p.trim().length > 0);

    for (const part of parts) {
      const trimmed = part.replace(/^\n+/, '');
      const lines = trimmed.split('\n');
      if (lines.length === 0) continue;

      const command = lines[0].trim();
      if (!command) continue;

      const headers: Record<string, string> = {};
      let bodyStart = 1;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line === '') {
          bodyStart = i + 1;
          break;
        }
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          headers[line.substring(0, colonIdx)] = line.substring(colonIdx + 1);
        }
        bodyStart = i + 1;
      }

      const body = lines.slice(bodyStart).join('\n');
      frames.push({ command, headers, body });
    }
    return frames;
  }

  private buildFrame(
    command: string,
    headers: Record<string, string>,
    body?: string,
  ): string {
    let frame = command + '\n';
    for (const [key, val] of Object.entries(headers)) {
      frame += `${key}:${val}\n`;
    }
    frame += '\n';
    if (body) frame += body;
    frame += '\0';
    return frame;
  }
}
