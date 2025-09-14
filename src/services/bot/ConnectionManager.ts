import WebSocket = require('ws');
import { IrisAPI } from '@/services/core/IrisAPI';
import { IrisRequest } from '@/types/models/base';
import { safeJsonParseWithReviver } from '@/utils';
import { Logger } from '@/utils/logger';

export interface ConnectionManagerOptions {
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
}

export class ConnectionManager {
  private ws?: WebSocket;
  private reconnectAttempts = 0;
  private reconnectDelay = 1000;
  private logger: Logger;
  private irisWsEndpoint: string;
  private api: IrisAPI;
  private botId?: string;
  private maxReconnectAttempts: number;
  private onMessageCallback?: (data: IrisRequest) => Promise<void>;

  constructor(
    irisUrl: string,
    api: IrisAPI,
    logger: Logger,
    options: ConnectionManagerOptions = {}
  ) {
    this.irisWsEndpoint = `ws://${irisUrl}/ws`;
    this.api = api;
    this.logger = logger;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.initialReconnectDelay || 1000;
  }

  /**
   * Set the callback for processing incoming messages
   */
  setMessageHandler(callback: (data: IrisRequest) => Promise<void>): void {
    this.onMessageCallback = callback;
  }

  /**
   * Get bot ID
   */
  getBotId(): string | undefined {
    return this.botId;
  }

  /**
   * Connect to WebSocket and handle reconnection
   */
  async connectWithRetry(): Promise<void> {
    while (true) {
      try {
        await this.connect();

        // Reset reconnect attempts on successful connection
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;

        // Wait for the connection to close
        await this.waitForDisconnection();

        this.logger.warn('Connection lost. Attempting to reconnect...');
      } catch (error) {
        this.logger.error('Connection error', error);

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.logger.error('Maximum reconnect attempts reached. Stopping.');
          throw error;
        }

        this.reconnectAttempts++;
        this.logger.info(`Reconnecting in ${this.reconnectDelay}ms...`, {
          attempt: this.reconnectAttempts,
          maxAttempts: this.maxReconnectAttempts,
          delay: this.reconnectDelay,
        });

        await this.sleep(this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
      }
    }
  }

  /**
   * Connect to WebSocket (single attempt)
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.irisWsEndpoint);

      const connectTimeout = setTimeout(() => {
        reject(new Error('Connection timed out'));
      }, 10000);

      this.ws.on('open', async () => {
        clearTimeout(connectTimeout);
        this.logger.info('WebSocket connected');

        try {
          const info = await this.api.getInfo();
          this.botId = String(info.bot_id);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const recv = data.toString();
          const rawData = safeJsonParseWithReviver(recv);

          // Restructure data similar to Python implementation
          const processedData = {
            ...rawData,
            raw: rawData.json,
          };
          delete processedData.json;

          if (this.onMessageCallback) {
            this.onMessageCallback(processedData as IrisRequest);
          }
        } catch (error) {
          this.logger.error('Iris event processing error occurred:', error);
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

  /**
   * Wait for WebSocket disconnection
   */
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

  /**
   * Close WebSocket connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * Initialize bot info without WebSocket connection
   */
  async initializeBotInfo(): Promise<void> {
    try {
      const info = await this.api.getInfo();
      this.botId = String(info.bot_id);
      this.logger.info(`Bot initialized with ID: ${this.botId}`);
    } catch (error) {
      this.logger.error('Failed to get bot info:', error);
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
