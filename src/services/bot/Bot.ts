/**
 * Refactored Bot class using manager pattern
 */

import { BaseController } from '@/controllers/BaseController';
import { setGlobalDebugLogger } from '@/decorators';
import {
  BatchScheduler,
  ScheduledMessage,
} from '@/services/core/BatchScheduler';
import { IrisAPI } from '@/services/core/IrisAPI';
import { IrisRequest } from '@/types/models/base';
import { EventEmitter } from '@/utils/event-emitter';
import { Logger } from '@/utils/logger';
import { ConnectionManager } from './ConnectionManager';
import { ControllerManager } from './ControllerManager';
import { EventManager } from './EventManager';
import { MessageProcessor } from './MessageProcessor';
import { WebhookManager } from './WebhookManager';

export type EventHandler = (context: any) => void | Promise<void>;
export type ErrorHandler = (context: any) => void | Promise<void>;

export interface BotOptions {
  maxWorkers?: number;
  saveChatLogs?: boolean;
  autoRegisterControllers?: boolean;
  httpMode?: boolean; // HTTP 웹훅 모드 활성화
  webhookPort?: number; // 웹훅 서버 포트 (기본: 3001)
  webhookPath?: string; // 웹훅 엔드포인트 경로 (기본: /webhook/message)
  logLevel?: 'error' | 'warn' | 'info' | 'debug'; // 로그 레벨 설정
}

export class Bot {
  private static instance: Bot | null = null;
  private static globalLogLevel: 'error' | 'warn' | 'info' | 'debug' = 'info';

  // Core components
  private logger: Logger;
  private bootstrapLogger: Logger;
  public api: IrisAPI;
  public name: string;
  private irisUrl: string;

  // Managers
  private connectionManager!: ConnectionManager;
  private webhookManager!: WebhookManager;
  private eventManager!: EventManager;
  private controllerManager!: ControllerManager;
  private messageProcessor!: MessageProcessor;
  private batchScheduler!: BatchScheduler;

  // Configuration
  private httpMode: boolean;
  private emitter: EventEmitter;

  /**
   * Get global log level for debugging
   */
  static getGlobalLogLevel(): 'error' | 'warn' | 'info' | 'debug' {
    return Bot.globalLogLevel;
  }

  /**
   * Create a logger with the global log level
   */
  static createLogger(name: string): Logger {
    return new Logger(name, { logLevel: Bot.globalLogLevel });
  }

  constructor(name: string, irisUrl: string, options: BotOptions = {}) {
    this.name = name;
    this.emitter = new EventEmitter(options.maxWorkers);

    // EventEmitter 메모리 누수 방지를 위해 maxListeners 증가
    process.setMaxListeners(20);

    // 전역 로그 레벨 설정
    Bot.globalLogLevel = options.logLevel || 'info';
    this.logger = new Logger('Bot', {
      saveChatLogs: options.saveChatLogs,
      logLevel: Bot.globalLogLevel,
    });
    this.bootstrapLogger = new Logger('Bootstrap', {
      logLevel: Bot.globalLogLevel,
    });

    // Set global debug logger for decorators
    const debugLogger = new Logger('DecoratorMetadata', {
      logLevel: Bot.globalLogLevel,
    });
    setGlobalDebugLogger(debugLogger);

    // Set static instance
    Bot.instance = this;

    // HTTP 웹훅 모드 설정
    this.httpMode = options.httpMode || false;

    // Clean up the URL similar to Python implementation
    this.irisUrl = irisUrl
      .replace(/^https?:\/\//, '')
      .replace(/^wss?:\/\//, '')
      .replace(/\/$/, '');

    // Validate URL format
    const urlParts = this.irisUrl.split(':');
    if (urlParts.length !== 2 || urlParts[0].split('.').length !== 4) {
      throw new Error(
        'Iris endpoint Address must be in IP:PORT format. ex) 172.30.10.66:3000'
      );
    }

    this.api = new IrisAPI(`http://${this.irisUrl}`);

    // Initialize managers
    this.initializeManagers(options);
  }

  /**
   * Initialize all manager instances
   */
  private initializeManagers(options: BotOptions): void {
    // Initialize BatchScheduler
    this.batchScheduler = BatchScheduler.getInstance();

    // Initialize EventManager
    this.eventManager = new EventManager(this.emitter, this.logger);

    // Initialize MessageProcessor
    this.messageProcessor = new MessageProcessor(this.eventManager, this.api);

    // Initialize ControllerManager
    this.controllerManager = new ControllerManager(
      this.bootstrapLogger,
      this.batchScheduler,
      this.eventManager,
      { autoRegisterControllers: options.autoRegisterControllers }
    );

    // Initialize ConnectionManager
    this.connectionManager = new ConnectionManager(
      this.irisUrl,
      this.api,
      this.logger
    );

    // Initialize WebhookManager
    this.webhookManager = new WebhookManager(this.name, this.logger, {
      port: options.webhookPort,
      path: options.webhookPath,
    });

    // Set up message handlers
    this.setupMessageHandlers();
  }

  /**
   * Setup message handlers for managers
   */
  private setupMessageHandlers(): void {
    // Setup message handler for connection manager
    this.connectionManager.setMessageHandler(async (data: IrisRequest) => {
      await this.messageProcessor.processIrisRequest(data);
    });

    // Setup message handler for webhook manager
    this.webhookManager.setMessageHandler(async (data: IrisRequest) => {
      await this.messageProcessor.processIrisRequest(data);
    });
  }

  /**
   * Get the current Bot instance
   */
  static getInstance(): Bot | null {
    return Bot.instance;
  }

  /**
   * Get the current Bot instance (throws if not initialized)
   */
  static requireInstance(): Bot {
    if (!Bot.instance) {
      throw new Error(
        'Bot instance not initialized. Create a Bot instance first.'
      );
    }
    return Bot.instance;
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
  on(event: 'feed', handler: EventHandler): void;
  on(event: 'unknown', handler: EventHandler): void;
  on(event: 'error', handler: ErrorHandler): void;
  on(event: string, handler: EventHandler | ErrorHandler): void {
    this.eventManager.on(event as any, handler as any);
  }

  /**
   * Remove event handler
   */
  off(event: string, handler: EventHandler | ErrorHandler): void {
    this.eventManager.off(event, handler as any);
  }

  /**
   * Register a controller with the bot
   */
  addController(controller: BaseController): void {
    this.controllerManager.addController(controller);
  }

  /**
   * Register multiple controllers
   */
  addControllers(...controllers: BaseController[]): void {
    this.controllerManager.addControllers(...controllers);
  }

  /**
   * Register controllers from constructor classes
   */
  registerControllers(controllerClasses: Array<new () => any>): void {
    this.controllerManager.registerControllers(controllerClasses);
  }

  /**
   * Start the bot and connect to Iris server
   */
  async run(): Promise<void> {
    // Run bootstrap handlers first
    try {
      this.logger.info('Running bootstrap handlers...');
      await this.batchScheduler.runBootstrap();
    } catch (error) {
      this.logger.error('Bootstrap error:', error);
    }

    // Start batch scheduler
    this.batchScheduler.start();
    this.logger.info('Batch scheduler started');

    // Set up scheduled message handler
    this.batchScheduler.onScheduledMessage(
      async (scheduledMessage: ScheduledMessage) => {
        try {
          await this.api.reply(
            scheduledMessage.roomId,
            scheduledMessage.message
          );
          this.logger.info(
            `Sent scheduled message to room ${scheduledMessage.roomId}: ${scheduledMessage.message}`
          );
        } catch (error) {
          this.logger.error('Failed to send scheduled message:', error);
        }
      }
    );

    // HTTP 웹훅 모드인 경우
    if (this.httpMode) {
      this.logger.info('Starting in HTTP webhook mode');

      // Initialize bot info
      await this.connectionManager.initializeBotInfo();

      // Set bot ID for message processor
      const botId = this.connectionManager.getBotId();
      if (botId) {
        this.messageProcessor.setBotId(botId);
      }

      // Start webhook server
      this.webhookManager.start();

      // Keep process alive
      return this.webhookManager.keepAlive();
    }

    // WebSocket 모드 (기본)
    this.logger.info('Starting in WebSocket mode');

    // Set bot ID for message processor when connection is established
    const botId = this.connectionManager.getBotId();
    if (botId) {
      this.messageProcessor.setBotId(botId);
    }

    // Start WebSocket connection with retry
    await this.connectionManager.connectWithRetry();
  }

  /**
   * Stop the bot
   */
  stop(): void {
    // Stop batch scheduler
    this.batchScheduler.stop();

    // Close connections
    this.connectionManager.close();
    this.webhookManager.stop();

    // Clear static instance
    if (Bot.instance === this) {
      Bot.instance = null;
    }
  }
}
