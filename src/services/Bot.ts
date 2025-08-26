/**
 * TypeScript port of iris.Bot
 */

import WebSocket = require('ws');
import { EventEmitter } from '../utils/eventEmitter';
import { IrisAPI } from './IrisAPI';
import {
  ChatContext,
  Message,
  Room,
  User,
  IrisRequest,
  ErrorContext,
} from '../types/models';

export type EventHandler = (context: ChatContext) => void | Promise<void>;
export type ErrorHandler = (context: ErrorContext) => void | Promise<void>;

export class Bot {
  private emitter: EventEmitter;
  private irisUrl: string;
  private irisWsEndpoint: string;
  public api: IrisAPI;
  private botId?: string;
  private ws?: WebSocket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  constructor(irisUrl: string, options: { maxWorkers?: number } = {}) {
    this.emitter = new EventEmitter(options.maxWorkers);

    // Clean up the URL similar to Python implementation
    this.irisUrl = irisUrl
      .replace(/^https?:\/\//, '')
      .replace(/^wss?:\/\//, '')
      .replace(/\/$/, '');

    // Validate URL format
    const urlParts = this.irisUrl.split(':');
    if (urlParts.length !== 2 || urlParts[0].split('.').length !== 4) {
      throw new Error(
        'Iris endpoint 주소는 IP:PORT 형식이어야 합니다. ex) 172.30.10.66:3000'
      );
    }

    this.irisWsEndpoint = `ws://${this.irisUrl}/ws`;
    this.api = new IrisAPI(`http://${this.irisUrl}`);
  }

  /**
   * Register an event handler
   */
  onEvent(
    name: string
  ): (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) => void {
    return (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) => {
      const originalMethod = descriptor.value;
      this.emitter.on(name, originalMethod.bind(target));
      return descriptor;
    };
  }

  /**
   * Register event handlers manually
   */
  on(event: 'chat', handler: EventHandler): void;
  on(event: 'message', handler: EventHandler): void;
  on(event: 'new_member', handler: EventHandler): void;
  on(event: 'del_member', handler: EventHandler): void;
  on(event: 'unknown', handler: EventHandler): void;
  on(event: 'error', handler: ErrorHandler): void;
  on(event: string, handler: EventHandler | ErrorHandler): void {
    this.emitter.on(event, handler as any);
  }

  /**
   * Remove event handler
   */
  off(event: string, handler: EventHandler | ErrorHandler): void {
    this.emitter.off(event, handler as any);
  }

  /**
   * Start the bot and connect to Iris server
   */
  async run(): Promise<void> {
    while (true) {
      try {
        await this.connect();

        // Reset reconnect attempts on successful connection
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;

        // Wait for the connection to close
        await this.waitForDisconnection();

        console.log('연결이 끊어졌습니다. 재연결을 시도합니다...');
      } catch (error) {
        console.error('연결 오류:', error);

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('최대 재연결 시도 횟수에 도달했습니다. 종료합니다.');
          throw error;
        }

        this.reconnectAttempts++;
        console.log(
          `${this.reconnectDelay}ms 후 재연결 시도... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );

        await this.sleep(this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
      }
    }
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.irisWsEndpoint);

      const connectTimeout = setTimeout(() => {
        reject(new Error('연결 시간 초과'));
      }, 10000);

      this.ws.on('open', async () => {
        clearTimeout(connectTimeout);
        console.log('웹소켓에 연결되었습니다');

        try {
          const info = await this.api.getInfo();
          this.botId = String(info.bot_id); // String으로 변환
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const recv = data.toString();
          const rawData = JSON.parse(recv);

          // Restructure data similar to Python implementation
          const processedData = {
            ...rawData,
            raw: rawData.json,
          };
          delete processedData.json;

          this.processIrisRequest(processedData as IrisRequest);
        } catch (error) {
          console.error('Iris 이벤트를 처리 중 오류가 발생했습니다:', error);
        }
      });

      this.ws.on('error', (error: Error) => {
        clearTimeout(connectTimeout);
        reject(error);
      });

      this.ws.on('close', () => {
        clearTimeout(connectTimeout);
        this.ws = undefined;
      });
    });
  }

  private async waitForDisconnection(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ws) {
        resolve();
        return;
      }

      this.ws.on('close', () => {
        resolve();
      });
    });
  }

  private async processChat(chat: ChatContext): Promise<void> {
    this.emitter.emit('chat', [chat]);

    const origin = chat.message.v?.origin;

    switch (origin) {
      case 'MSG':
        this.emitter.emit('message', [chat]);
        break;
      case 'NEWMEM':
        this.emitter.emit('new_member', [chat]);
        break;
      case 'DELMEM':
        this.emitter.emit('del_member', [chat]);
        break;
      default:
        this.emitter.emit('unknown', [chat]);
        break;
    }
  }

  private async processIrisRequest(req: IrisRequest): Promise<void> {
    let v: Record<string, any> = {};

    try {
      v = JSON.parse(req.raw.v || '{}');
    } catch {
      // Ignore JSON parse errors
    }

    const room = new Room(req.raw.chat_id, req.room, this.api);

    const sender = new User(
      req.raw.user_id,
      room.id,
      this.api,
      req.sender,
      this.botId
    );

    const message = new Message(
      req.raw.id,
      parseInt(req.raw.type),
      req.raw.message || '',
      req.raw.attachment || '',
      v
    );

    const chat = new ChatContext(room, sender, message, req.raw, this.api);

    await this.processChat(chat);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Stop the bot
   */
  stop(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}
