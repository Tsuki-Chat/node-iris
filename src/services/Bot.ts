/**
 * TypeScript port of iris.Bot
 */

import WebSocket = require('ws');
import express = require('express');
import { BaseController } from '../controllers/BaseController';
import {
  addContextToSchedule,
  debugDecoratorMetadata,
  decoratorMetadata,
  getBatchControllers,
  getBootstrapControllers,
  getBootstrapMethods,
  getDecoratedMethods,
  getFullCommand,
  getMessageHandlers,
  getRegisteredCommands,
  getRegisteredControllers,
  getScheduleMessageMethods,
  getScheduleMethods,
  isCommandMatch,
} from '../decorators';
import {
  ChatContext,
  ErrorContext,
  FeedType,
  IrisRequest,
  Message,
  Room,
  User,
  VField,
} from '../types/models';
import { EventEmitter } from '../utils/eventEmitter';
import { Logger } from '../utils/logger';
import { BatchScheduler, ScheduledMessage } from './BatchScheduler';
import { IrisAPI } from './IrisAPI';

export type EventHandler = (context: ChatContext) => void | Promise<void>;
export type ErrorHandler = (context: ErrorContext) => void | Promise<void>;

export interface BotOptions {
  maxWorkers?: number;
  saveChatLogs?: boolean;
  autoRegisterControllers?: boolean;
  httpMode?: boolean; // HTTP 웹훅 모드 활성화
  webhookPort?: number; // 웹훅 서버 포트 (기본: 3001)
  webhookPath?: string; // 웹훅 엔드포인트 경로 (기본: /webhook/message)
}

export class Bot {
  private static instance: Bot | null = null;

  private emitter: EventEmitter;
  private irisUrl: string;
  private irisWsEndpoint: string;
  public api: IrisAPI;
  private botId?: string;
  private ws?: WebSocket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private logger: Logger;
  private bootstrapLogger: Logger;
  public name: string;

  // Controller support
  private controllers: BaseController[] = [];
  private registeredMethods: Function[] = [];
  private batchScheduler: BatchScheduler;

  // HTTP 웹훅 모드 관련 속성
  private httpMode: boolean;
  private webhookPort: number;
  private webhookPath: string;
  private expressApp?: express.Application;
  private httpServer?: any;

  constructor(name: string, irisUrl: string, options: BotOptions = {}) {
    this.name = name;
    this.emitter = new EventEmitter(options.maxWorkers);
    this.logger = new Logger('Bot', { saveChatLogs: options.saveChatLogs });
    this.bootstrapLogger = new Logger('Bootstrap');

    // Set static instance
    Bot.instance = this;

    // HTTP 웹훅 모드 설정
    this.httpMode = options.httpMode || false;
    this.webhookPort = options.webhookPort || 3001;
    this.webhookPath = options.webhookPath || '/webhook/message';

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

    this.irisWsEndpoint = `ws://${this.irisUrl}/ws`;
    this.api = new IrisAPI(`http://${this.irisUrl}`);

    // Initialize BatchScheduler
    this.batchScheduler = BatchScheduler.getInstance();

    // Auto-register controllers only if enabled (default: true for backward compatibility)
    if (options.autoRegisterControllers !== false) {
      this.autoRegisterControllers();
    }
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
    this.emitter.on(event, handler as any);
  }

  /**
   * Remove event handler
   */
  off(event: string, handler: EventHandler | ErrorHandler): void {
    this.emitter.off(event, handler as any);
  }

  /**
   * Register a controller with the bot
   */
  addController(controller: BaseController): void {
    this.controllers.push(controller);
    this.registerControllerMethods(controller);
  }

  /**
   * Register multiple controllers
   */
  addControllers(...controllers: BaseController[]): void {
    controllers.forEach((controller) => this.addController(controller));
  }

  /**
   * Register controllers from constructor classes
   */
  registerControllers(controllerClasses: Array<new () => any>): void {
    for (const ControllerClass of controllerClasses) {
      try {
        const controller = new ControllerClass();

        // Check if it's a batch controller
        const batchControllers = getBatchControllers();
        let isBatchController = false;
        for (const [eventType, controllers] of batchControllers) {
          if (controllers.includes(ControllerClass)) {
            this.registerBatchController(controller);
            isBatchController = true;
            this.bootstrapLogger.info(
              `Registered batch controller: ${ControllerClass.name}`
            );
            break;
          }
        }

        // Check if it's a bootstrap controller
        const bootstrapControllers = getBootstrapControllers();
        let isBootstrapController = false;
        for (const [eventType, controllers] of bootstrapControllers) {
          if (controllers.includes(ControllerClass)) {
            this.registerBootstrapController(controller);
            isBootstrapController = true;
            this.bootstrapLogger.info(
              `Registered bootstrap controller: ${ControllerClass.name}`
            );
            break;
          }
        }

        // If it's neither batch nor bootstrap, register as normal controller
        if (!isBatchController && !isBootstrapController) {
          this.addController(controller);
          this.bootstrapLogger.info(
            `Registered controller: ${ControllerClass.name}`
          );
        }
      } catch (error) {
        this.bootstrapLogger.error(
          `Failed to register controller ${ControllerClass.name}:`,
          error
        );
      }
    }
  }

  /**
   * Register a batch controller
   */
  registerBatchController(controller: any): void {
    // Register schedule methods
    const scheduleMethods = getScheduleMethods(controller);
    for (const {
      method,
      scheduleId,
      interval,
      cronExpression,
    } of scheduleMethods) {
      if (interval) {
        this.batchScheduler.registerScheduleTask(
          scheduleId,
          interval,
          method as (contexts: ChatContext[]) => Promise<void>
        );
        this.bootstrapLogger.info(
          `Registered schedule task: ${scheduleId} (${interval}ms)`
        );
      } else if (cronExpression) {
        this.batchScheduler.registerCronTask(
          scheduleId,
          cronExpression,
          method as (contexts: ChatContext[]) => Promise<void>
        );
        this.bootstrapLogger.info(
          `Registered cron task: ${scheduleId} (${cronExpression})`
        );
      }
    }

    // Register schedule message methods
    const scheduleMessageMethods = getScheduleMessageMethods(controller);
    for (const { method, key } of scheduleMessageMethods) {
      // Set up scheduled message handler
      this.batchScheduler.onScheduledMessage(async (scheduledMessage) => {
        if (scheduledMessage.metadata?.key === key) {
          try {
            await method(scheduledMessage);
          } catch (error) {
            this.logger.error(
              `Schedule message handler error for key ${key}:`,
              error
            );
          }
        }
      });
      this.bootstrapLogger.info(
        `Registered schedule message handler for key: ${key}`
      );
    }
  }

  /**
   * Register a bootstrap controller
   */
  registerBootstrapController(controller: any): void {
    const bootstrapMethods = getBootstrapMethods(controller);
    for (const { method, priority } of bootstrapMethods) {
      this.batchScheduler.registerBootstrapHandler(
        method as () => Promise<void>,
        priority
      );
      this.bootstrapLogger.info(
        `Registered bootstrap handler with priority: ${priority}`
      );
    }
  }

  /**
   * Auto-register controllers from the decorator registry
   */
  private autoRegisterControllers(): void {
    // Register normal controllers
    const controllers = getRegisteredControllers();
    controllers.forEach((controllerClasses, eventType) => {
      controllerClasses.forEach((controllerClass) => {
        const controller = new controllerClass();
        this.addController(controller);
        this.bootstrapLogger.info(
          `Auto-registered ${controllerClass.name} for ${eventType} events`
        );
      });
    });

    // Register batch controllers
    const batchControllers = getBatchControllers();
    batchControllers.forEach((controllerClasses, eventType) => {
      controllerClasses.forEach((controllerClass) => {
        const controller = new controllerClass();
        this.registerBatchController(controller);
        this.bootstrapLogger.info(
          `Auto-registered batch controller: ${controllerClass.name}`
        );
      });
    });

    // Register bootstrap controllers
    const bootstrapControllers = getBootstrapControllers();
    bootstrapControllers.forEach((controllerClasses, eventType) => {
      controllerClasses.forEach((controllerClass) => {
        const controller = new controllerClass();
        this.registerBootstrapController(controller);
        this.bootstrapLogger.info(
          `Auto-registered bootstrap controller: ${controllerClass.name}`
        );
      });
    });
  }

  /**
   * Register controller methods as event handlers
   */
  private registerControllerMethods(controller: any): void {
    const controllerName = controller.constructor.name;

    debugDecoratorMetadata(controller);

    // Get the registered controller types to determine which event this controller handles
    const registeredControllers = getRegisteredControllers();
    let eventType: string | null = null;

    // Find which event type this controller is registered for
    for (const [type, controllerClasses] of registeredControllers) {
      for (const controllerClass of controllerClasses) {
        if (controller instanceof controllerClass) {
          eventType = type;
          break;
        }
      }
      if (eventType) break;
    }

    // If no event type found, try to infer from class name (fallback)
    if (!eventType) {
      if (controllerName.includes('Message')) eventType = 'message';
      else if (controllerName.includes('Feed')) eventType = 'feed';
      else if (controllerName.includes('NewMember')) eventType = 'new_member';
      else if (controllerName.includes('DeleteMember'))
        eventType = 'del_member';
      else if (controllerName.includes('Error')) eventType = 'error';
      else if (controllerName.includes('Unknown')) eventType = 'unknown';
      else if (controllerName.includes('Chat')) eventType = 'chat';
    }

    switch (eventType) {
      case 'message':
        // Register all methods from the controller
        const prototype = Object.getPrototypeOf(controller);
        const methodNames = Object.getOwnPropertyNames(prototype);

        // Set up automatic message routing
        this.on('message', async (context: ChatContext) => {
          const { message, room, sender } = context;
          const senderName = await sender.getName();

          // Enhanced logging based on message type
          let logMessage = '';
          let logMessageType = 'MSG';

          if (message.isStringMessage()) {
            // Normal text message
            logMessage = message.msg as string;
          } else if (message.isFeedMessage()) {
            // Feed message - use formatted feed log message
            logMessage = message.getFeedLogMessage();
            logMessageType = 'FeedType: ' + (message.msg as FeedType).feedType;
          } else {
            // Other message types - create descriptive log based on type
            logMessage = this.getMessageTypeDescription(message);
            logMessageType = 'Type: ' + message.type;
          }

          if (logMessage.includes('\n')) {
            logMessage = logMessage.split('\n')[0];
          }

          this.logger.chat(
            logMessageType,
            room.name,
            senderName || 'Unknown',
            logMessage
          );

          // Add context to all schedule tasks for batch processing
          const batchControllers = getBatchControllers();
          for (const [eventType, controllerClasses] of batchControllers) {
            for (const controllerClass of controllerClasses) {
              const scheduleMethods = getScheduleMethods(new controllerClass());
              for (const { scheduleId } of scheduleMethods) {
                addContextToSchedule(scheduleId, context);
              }
            }
          }

          // Execute all OnMessage handlers first
          const messageHandlers = getMessageHandlers(controller);
          for (const handler of messageHandlers) {
            try {
              // Check room restrictions for OnMessage handlers
              if (!this.isRoomAllowed(controller, handler, context.room.id)) {
                this.logger.debug(
                  `Message handler ${handler.name} blocked by room restrictions`,
                  {
                    roomId: context.room.id,
                    roomName: context.room.name,
                    handlerName: handler.name,
                    controllerName: controller.constructor.name,
                  }
                );
                continue; // Skip this handler if room is not allowed
              }

              await handler(context);
            } catch (error) {
              this.logger.error('Error executing OnMessage handler', error);
            }
          }

          // Check all registered commands to see if any match
          const commands = getRegisteredCommands();

          for (const [baseCommand, commandInfo] of commands) {
            // Get the full command with prefix for this controller
            const fullCommand = getFullCommand(
              controller.constructor,
              commandInfo.originalMethod,
              baseCommand
            );

            if (
              typeof message.msg === 'string' &&
              isCommandMatch(message.msg, fullCommand)
            ) {
              // Find the corresponding method in this controller
              const methodName = commandInfo.method;
              const method = controller[methodName];

              if (method && typeof method === 'function') {
                try {
                  // Check room restrictions
                  if (
                    !this.isRoomAllowed(controller, method, context.room.id)
                  ) {
                    this.logger.debug(
                      `Command ${fullCommand} blocked by room restrictions`,
                      {
                        roomId: context.room.id,
                        roomName: context.room.name,
                        command: fullCommand,
                        methodName: methodName,
                        controllerName: controller.constructor.name,
                      }
                    );
                    continue; // Skip this command if room is not allowed
                  }

                  // Update context with command-specific parameter
                  const commandParam =
                    message.getParameterForCommand(fullCommand);
                  const hasCommandParam =
                    message.hasParameterForCommand(fullCommand);

                  // Update the existing context's message properties instead of creating a new object
                  const originalMessage = context.message;
                  context.message.param = commandParam;
                  context.message.hasParam = hasCommandParam;
                  context.message.command = fullCommand;

                  this.logger.command(
                    room.name,
                    senderName || 'Unknown',
                    `${fullCommand} -> ${methodName}${commandParam ? ` (param: ${commandParam})` : ''}`
                  );

                  try {
                    await method.call(controller, context);
                  } finally {
                    // Restore original message properties
                    context.message.param = originalMessage.param;
                    context.message.hasParam = originalMessage.hasParam;
                    context.message.command = originalMessage.command;
                  }
                } catch (error) {
                  this.logger.error(
                    `Error executing command ${fullCommand} in room ${room.name}`,
                    error,
                    { command: fullCommand, methodName, sender: senderName }
                  );
                }
              }
            }
          }
        });
        break;

      case 'new_member':
        this.on('new_member', async (context: ChatContext) => {
          try {
            const memberName = await context.sender.getName();
            this.logger.newMember(context.room.name, memberName || 'Unknown');

            // Execute all decorated methods
            const decoratedMethods = getDecoratedMethods(controller);
            for (const method of decoratedMethods) {
              try {
                // Check room restrictions for each method
                if (!this.isRoomAllowed(controller, method, context.room.id)) {
                  this.logger.debug(
                    `NewMember method ${method.name} blocked by room restrictions`,
                    {
                      roomId: context.room.id,
                      roomName: context.room.name,
                      methodName: method.name,
                      controllerName: controller.constructor.name,
                    }
                  );
                  continue; // Skip this method if room is not allowed
                }

                await method(context);
              } catch (error) {
                this.logger.error(
                  'Error executing decorated method in NewMemberController',
                  error
                );
              }
            }
          } catch (error) {
            this.logger.error('Error in new member handler', error);
          }
        });
        break;

      case 'del_member':
        this.on('del_member', async (context: ChatContext) => {
          try {
            const memberName = await context.sender.getName();
            this.logger.delMember(context.room.name, memberName || 'Unknown');

            // Execute all decorated methods
            const decoratedMethods = getDecoratedMethods(controller);
            for (const method of decoratedMethods) {
              try {
                // Check room restrictions for each method
                if (!this.isRoomAllowed(controller, method, context.room.id)) {
                  this.logger.debug(
                    `DelMember method ${method.name} blocked by room restrictions`,
                    {
                      roomId: context.room.id,
                      roomName: context.room.name,
                      methodName: method.name,
                      controllerName: controller.constructor.name,
                    }
                  );
                  continue; // Skip this method if room is not allowed
                }

                await method(context);
              } catch (error) {
                this.logger.error(
                  'Error executing decorated method in DeleteMemberController',
                  error
                );
              }
            }
          } catch (error) {
            this.logger.error('Error in delete member handler', error);
          }
        });
        break;

      case 'error':
        this.on('error', async (error: any) => {
          try {
            // Execute all decorated methods
            const decoratedMethods = getDecoratedMethods(controller);
            for (const method of decoratedMethods) {
              try {
                await method(error);
              } catch (methodError) {
                this.logger.error(
                  'Error executing decorated method in ErrorController',
                  methodError
                );
              }
            }
          } catch (handlerError) {
            this.logger.error('Error in error handler', handlerError);
          }
        });
        break;

      case 'feed':
        this.on('feed', async (context: ChatContext) => {
          try {
            const { message, room, sender } = context;
            const senderName = await sender.getName();
            const origin = message.v?.origin;

            // Enhanced logging for feed messages
            let logMessage = '';
            let logMessageType = '';

            if (message.isFeedMessage()) {
              logMessage = message.getFeedLogMessage();
            } else {
              logMessage = `Unknown FeedType`;
            }
            logMessageType = 'FeedType: ' + (message.msg as FeedType).feedType;

            this.logger.chat(
              logMessageType,
              room.name,
              senderName || 'System',
              logMessage
            );

            // Execute all OnMessage and feed-specific handlers
            const messageHandlers = getMessageHandlers(controller);
            this.logger.debug(
              `Found ${messageHandlers.length} message handlers`
            );

            for (const handler of messageHandlers) {
              try {
                // Check room restrictions for message handlers
                if (!this.isRoomAllowed(controller, handler, context.room.id)) {
                  this.logger.debug(
                    `Feed message handler ${handler.name} blocked by room restrictions`,
                    {
                      roomId: context.room.id,
                      roomName: context.room.name,
                      handlerName: handler.name,
                      controllerName: controller.constructor.name,
                    }
                  );
                  continue; // Skip this handler if room is not allowed
                }

                this.logger.debug(`Executing message handler: ${handler.name}`);
                await handler(context);
              } catch (error) {
                this.logger.error('Error executing feed handler', error);
              }
            }

            // Execute all decorated methods
            const decoratedMethods = getDecoratedMethods(controller);
            this.logger.debug(
              `Found ${decoratedMethods.length} decorated methods`
            );

            for (const method of decoratedMethods) {
              try {
                // Check room restrictions for decorated methods
                if (!this.isRoomAllowed(controller, method, context.room.id)) {
                  this.logger.debug(
                    `Feed decorated method ${method.name} blocked by room restrictions`,
                    {
                      roomId: context.room.id,
                      roomName: context.room.name,
                      methodName: method.name,
                      controllerName: controller.constructor.name,
                    }
                  );
                  continue; // Skip this method if room is not allowed
                }

                this.logger.debug(`Executing decorated method: ${method.name}`);
                await method(context);
              } catch (error) {
                this.logger.error(
                  'Error executing decorated method in FeedController',
                  error
                );
              }
            }
          } catch (error) {
            this.logger.error('Error in feed handler', error);
          }
        });
        break;

      case 'unknown':
        this.on('unknown', async (context: ChatContext) => {
          try {
            // Execute all decorated methods
            const decoratedMethods = getDecoratedMethods(controller);
            for (const method of decoratedMethods) {
              try {
                // Check room restrictions for each method
                if (!this.isRoomAllowed(controller, method, context.room.id)) {
                  this.logger.debug(
                    `Unknown method ${method.name} blocked by room restrictions`,
                    {
                      roomId: context.room.id,
                      roomName: context.room.name,
                      methodName: method.name,
                      controllerName: controller.constructor.name,
                    }
                  );
                  continue; // Skip this method if room is not allowed
                }

                await method(context);
              } catch (error) {
                this.logger.error(
                  'Error executing decorated method in UnknownController',
                  error
                );
              }
            }
          } catch (error) {
            this.logger.error('Error in unknown handler', error);
          }
        });
        break;

      case 'chat':
        this.on('chat', async (context: ChatContext) => {
          try {
            // Execute all decorated methods
            const decoratedMethods = getDecoratedMethods(controller);
            for (const method of decoratedMethods) {
              try {
                // Check room restrictions for each method
                if (!this.isRoomAllowed(controller, method, context.room.id)) {
                  this.logger.debug(
                    `Chat method ${method.name} blocked by room restrictions`,
                    {
                      roomId: context.room.id,
                      roomName: context.room.name,
                      methodName: method.name,
                      controllerName: controller.constructor.name,
                    }
                  );
                  continue; // Skip this method if room is not allowed
                }

                await method(context);
              } catch (error) {
                this.logger.error(
                  'Error executing decorated method in ChatController',
                  error
                );
              }
            }
          } catch (error) {
            this.logger.error('Error in chat handler', error);
          }
        });
        break;

      default:
        if (eventType) {
          this.logger.warn(
            `Unknown event type: ${eventType} for controller ${controllerName}`
          );
        } else {
          this.logger.warn(
            `Could not determine event type for controller ${controllerName}. Make sure to use appropriate controller decorators (@MessageController, @FeedController, etc.)`
          );
        }
        break;
    }
  }

  /**
   * Set up HTTP webhook server
   */
  private setupWebhookServer(): void {
    if (!this.httpMode) return;

    this.expressApp = express();

    // Body parser middleware with increased limits for large messages
    this.expressApp.use(
      express.json({
        limit: '50mb',
        type: ['application/json', 'text/plain'],
      })
    );
    this.expressApp.use(
      express.urlencoded({
        extended: true,
        limit: '50mb',
        parameterLimit: 50000,
      })
    );

    // Health check endpoint
    this.expressApp.get('/health', (req, res) => {
      res.json({ status: 'OK', mode: 'webhook', bot: this.name });
    });

    // Webhook endpoint
    this.expressApp.post(this.webhookPath, async (req, res) => {
      try {
        const requestData = req.body;

        this.logger.debug('Webhook received data:', requestData);

        if (!requestData) {
          res.status(400).json({ error: 'No data received' });
          return;
        }

        // Convert webhook data to IrisRequest format
        let irisRequest: IrisRequest;

        if (requestData.json) {
          // If data has 'json' field, use it as raw data
          irisRequest = {
            room: requestData.room,
            sender: requestData.sender,
            raw: requestData.json,
          };
        } else if (requestData.raw) {
          // If data already has 'raw' field (standard IrisRequest format)
          irisRequest = requestData as IrisRequest;
        } else {
          // Try to use the entire request body as raw data
          irisRequest = {
            room: requestData.room || 'Unknown',
            sender: requestData.sender || 'Unknown',
            raw: requestData,
          };
        }

        this.logger.debug('Processed IrisRequest:', {
          room: irisRequest.room,
          sender: irisRequest.sender,
          rawKeys: Object.keys(irisRequest.raw),
        });

        // Process the request like WebSocket message
        await this.processIrisRequest(irisRequest);

        res.json({ status: 'OK', processed: true });
      } catch (error) {
        this.logger.error('Webhook processing error:', error);

        res.status(500).json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Start HTTP server
    this.httpServer = this.expressApp.listen(this.webhookPort, () => {
      this.logger.info(
        `HTTP webhook server started on port ${this.webhookPort}`
      );
      this.logger.info(`Webhook endpoint: POST ${this.webhookPath}`);
    });
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

      // Get bot info
      try {
        const info = await this.api.getInfo();
        this.botId = String(info.bot_id);
        this.logger.info(`Bot initialized with ID: ${this.botId}`);
      } catch (error) {
        this.logger.error('Failed to get bot info:', error);
        throw error;
      }

      // Setup webhook server
      this.setupWebhookServer();

      // Keep process alive
      return new Promise(() => {
        // Process will stay alive due to HTTP server
      });
    }

    // WebSocket 모드 (기본)
    this.logger.info('Starting in WebSocket mode');
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
          this.batchScheduler.stop();
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
      case 'WRITE':
        this.emitter.emit('message', [chat]);
        break;
      case 'NEWMEM':
        this.emitter.emit('new_member', [chat]);
        break;
      case 'DELMEM':
        this.emitter.emit('del_member', [chat]);
        break;
      // Feed message origins
      case 'SYNCDLMSG':
      case 'JOINLINK':
      case 'KICKED':
      case 'SYNCMEMT':
      case 'SYNCREWR':
        this.emitter.emit('feed', [chat]);
        break;
      default:
        this.emitter.emit('unknown', [chat]);
        break;
    }
  }

  private async processIrisRequest(req: IrisRequest): Promise<void> {
    let v: VField = {};

    try {
      v = JSON.parse(req.raw.v || '{}') as VField;
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
   * Get descriptive text for different message types
   */
  private getMessageTypeDescription(message: Message): string {
    // Handle image messages
    if (message.isImageMessage()) {
      if (message.isPhotoMessage()) {
        return '[Photo]';
      } else if (message.isMultiPhotoMessage()) {
        return '[Multiple Photo (Legacy)]';
      } else if (message.isNewMultiPhotoMessage()) {
        return '[Multiple Photo]';
      }
    }

    // Handle other media types
    if (message.isVideoMessage()) {
      return '[Video]';
    }

    if (message.isAudioMessage()) {
      return '[Audio]';
    }

    if (message.isFileMessage()) {
      return '[File]';
    }

    // Handle emoticons
    if (message.isEmoticonMessage()) {
      if (message.isOldEmoticonMessage()) {
        return '[Emoti (Old)]';
      } else if (message.isBigEmoticonMessage()) {
        return '[Big Emoticon]';
      } else if (message.isMobileEmoticonMessage()) {
        return '[Mobile Emoticon]';
      } else if (message.isPCEmoticonMessage()) {
        return '[PC Emoticon]';
      }
    }

    // Handle other message types
    if (message.isMapMessage()) {
      return '[Map]';
    }

    if (message.isProfileMessage()) {
      return '[Profile]';
    }

    if (message.isReplyMessage()) {
      return '[Reply]';
    }

    // Fallback for unknown types
    return `[Unknown message type: ${message.type}]`;
  }

  /**
   * Stop the bot
   */
  stop(): void {
    // Stop batch scheduler
    this.batchScheduler.stop();

    // Close WebSocket connection if exists
    if (this.ws) {
      this.ws.close();
    }

    // Close HTTP server if exists
    if (this.httpServer) {
      this.httpServer.close(() => {
        this.logger.info('HTTP webhook server stopped');
      });
    }

    // Clear static instance
    if (Bot.instance === this) {
      Bot.instance = null;
    }
  }

  /**
   * Check if the current room is allowed for the controller/method
   */
  private isRoomAllowed(
    controller: any,
    method: Function,
    roomId: string
  ): boolean {
    // Check method-level room restrictions (multiple ways for reliability)

    // 1. Check direct method property
    if ((method as any).__allowedRooms) {
      const allowedRooms = (method as any).__allowedRooms as string[];
      const isAllowed = allowedRooms.includes(roomId);
      this.logger.debug(
        `Method-level room check (direct property): ${isAllowed}`,
        {
          roomId,
          allowedRooms,
          methodName: method.name,
        }
      );
      return isAllowed;
    }

    // 2. Check decorator metadata map
    const methodMetadata = decoratorMetadata.get(method);
    if (methodMetadata && (methodMetadata as any).allowedRooms) {
      const allowedRooms = (methodMetadata as any).allowedRooms as string[];
      const isAllowed = allowedRooms.includes(roomId);
      this.logger.debug(
        `Method-level room check (metadata map): ${isAllowed}`,
        {
          roomId,
          allowedRooms,
          methodName: method.name,
        }
      );
      return isAllowed;
    }

    // 3. Check method's decorator metadata property
    if (
      (method as any).__decoratorMetadata &&
      (method as any).__decoratorMetadata.allowedRooms
    ) {
      const allowedRooms = (method as any).__decoratorMetadata
        .allowedRooms as string[];
      const isAllowed = allowedRooms.includes(roomId);
      this.logger.debug(
        `Method-level room check (decorator metadata property): ${isAllowed}`,
        {
          roomId,
          allowedRooms,
          methodName: method.name,
        }
      );
      return isAllowed;
    }

    // Check class-level room restrictions
    if ((controller.constructor as any).__allowedRooms) {
      const allowedRooms = (controller.constructor as any)
        .__allowedRooms as string[];
      const isAllowed = allowedRooms.includes(roomId);
      this.logger.debug(`Class-level room check: ${isAllowed}`, {
        roomId,
        allowedRooms,
        controllerName: controller.constructor.name,
      });
      return isAllowed;
    }

    // No restrictions means allowed
    this.logger.debug(`No room restrictions found, allowing access`, {
      roomId,
      methodName: method.name,
      controllerName: controller.constructor.name,
    });
    return true;
  }
}
