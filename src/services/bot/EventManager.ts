import {
  debugDecoratorMetadata,
  decoratorMetadata,
  getBatchControllers,
  getDecoratedMethods,
  getFullCommand,
  getMessageHandlers,
  getRegisteredCommands,
  getRegisteredControllers,
  isCommandMatch,
} from '@/decorators';
import { ChatContext } from '@/types/models/classes';
import { FeedType } from '@/types/models/feed-types';
import { Message } from '@/types/models/message';
import { EventEmitter } from '@/utils/event-emitter';
import { Logger } from '@/utils/logger';

export type EventHandler = (context: ChatContext) => void | Promise<void>;
export type ErrorHandler = (context: any) => void | Promise<void>;

export class EventManager {
  private emitter: EventEmitter;
  private logger: Logger;

  constructor(emitter: EventEmitter, logger: Logger) {
    this.emitter = emitter;
    this.logger = logger;
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
   * Emit event
   */
  emit(event: string, args: any[]): void {
    this.emitter.emit(event, args);
  }

  /**
   * Register controller methods as event handlers
   */
  registerControllerMethods(controller: any): void {
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
        this.registerMessageController(controller);
        break;
      case 'new_member':
        this.registerNewMemberController(controller);
        break;
      case 'del_member':
        this.registerDelMemberController(controller);
        break;
      case 'error':
        this.registerErrorController(controller);
        break;
      case 'feed':
        this.registerFeedController(controller);
        break;
      case 'unknown':
        this.registerUnknownController(controller);
        break;
      case 'chat':
        this.registerChatController(controller);
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
   * Register message controller
   */
  private registerMessageController(controller: any): void {
    this.on('message', async (context: ChatContext) => {
      const { message, room, sender } = context;
      const senderName = await sender.getName();

      // Enhanced logging based on message type
      let logMessage = '';
      let logMessageType = 'MSG';

      this.logger.debug(`Message type analysis:`, {
        type: message.type,
        isStringMessage: message.isStringMessage(),
        isFeedMessage: message.isFeedMessage(),
        isEmoticonMessage: message.isEmoticonMessage(),
        isMobileEmoticonMessage: message.isMobileEmoticonMessage(),
        msgContent: message.msg,
      });

      if (message.isFeedMessage()) {
        // Feed message - use formatted feed log message
        logMessage = message.getFeedLogMessage();
        logMessageType = 'FeedType: ' + (message.msg as FeedType).feedType;
      } else if (
        message.isEmoticonMessage() ||
        message.isImageMessage() ||
        message.isVideoMessage() ||
        message.isAudioMessage() ||
        message.isFileMessage() ||
        message.isMapMessage() ||
        message.isProfileMessage() ||
        message.isReplyMessage()
      ) {
        // Special message types - create descriptive log with type and content
        const typeDescription = this.getMessageTypeDescription(message);
        const msgContent = typeof message.msg === 'string' ? message.msg : '';

        if (msgContent.trim()) {
          logMessage = `${msgContent}`;
        } else {
          logMessage = 'No text content';
        }
        logMessageType = typeDescription + ' | Type: ' + message.type;
        this.logger.debug(`Using message type description: ${logMessage}`);
      } else if (message.isStringMessage() && (message.msg as string).trim()) {
        // Normal text message (non-empty string)
        logMessage = message.msg as string;
      } else {
        // Fallback for unknown or empty message types
        logMessage = this.getMessageTypeDescription(message);
        logMessageType = `Type: ${message.type}`;
        this.logger.debug(
          `Using fallback message type description: ${logMessage}`
        );
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
          // This would need to be refactored to work with the new structure
          // For now, keeping the original logic
        }
      }

      // Execute all OnMessage handlers first
      const messageHandlers = getMessageHandlers(controller);
      for (const handler of messageHandlers) {
        try {
          // Check room restrictions for OnMessage handlers
          if (
            !this.isRoomAllowed(
              controller,
              handler,
              context.room.getIdAsString()
            )
          ) {
            this.logger.debug(
              `Message handler ${handler.name} blocked by room restrictions`,
              {
                roomId: context.room.getIdAsString(),
                roomName: context.room.name,
                handlerName: handler.name,
                controllerName: controller.constructor.name,
              }
            );
            continue; // Skip this handler if room is not allowed
          }

          await handler.call(controller, context);
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
                !this.isRoomAllowed(
                  controller,
                  method,
                  context.room.getIdAsString()
                )
              ) {
                this.logger.debug(
                  `Command ${fullCommand} blocked by room restrictions`,
                  {
                    roomId: context.room.getIdAsString(),
                    roomName: context.room.name,
                    command: fullCommand,
                    methodName: methodName,
                    controllerName: controller.constructor.name,
                  }
                );
                continue; // Skip this command if room is not allowed
              }

              // Update context with command-specific parameter
              const commandParam = message.getParameterForCommand(fullCommand);
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
  }

  /**
   * Register new member controller
   */
  private registerNewMemberController(controller: any): void {
    this.on('new_member', async (context: ChatContext) => {
      try {
        const memberName = await context.sender.getName();
        this.logger.newMember(context.room.name, memberName || 'Unknown');

        // Execute all decorated methods
        const decoratedMethods = getDecoratedMethods(controller);
        for (const method of decoratedMethods) {
          try {
            // Check room restrictions for each method
            if (
              !this.isRoomAllowed(
                controller,
                method,
                context.room.getIdAsString()
              )
            ) {
              this.logger.debug(
                `NewMember method ${method.name} blocked by room restrictions`,
                {
                  roomId: context.room.getIdAsString(),
                  roomName: context.room.name,
                  methodName: method.name,
                  controllerName: controller.constructor.name,
                }
              );
              continue; // Skip this method if room is not allowed
            }

            await method.call(controller, context);
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
  }

  /**
   * Register delete member controller
   */
  private registerDelMemberController(controller: any): void {
    this.on('del_member', async (context: ChatContext) => {
      try {
        const memberName = await context.sender.getName();
        this.logger.delMember(context.room.name, memberName || 'Unknown');

        // Execute all decorated methods
        const decoratedMethods = getDecoratedMethods(controller);
        for (const method of decoratedMethods) {
          try {
            // Check room restrictions for each method
            if (
              !this.isRoomAllowed(
                controller,
                method,
                context.room.getIdAsString()
              )
            ) {
              this.logger.debug(
                `DelMember method ${method.name} blocked by room restrictions`,
                {
                  roomId: context.room.getIdAsString(),
                  roomName: context.room.name,
                  methodName: method.name,
                  controllerName: controller.constructor.name,
                }
              );
              continue; // Skip this method if room is not allowed
            }

            await method.call(controller, context);
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
  }

  /**
   * Register error controller
   */
  private registerErrorController(controller: any): void {
    this.on('error', async (error: any) => {
      try {
        // Execute all decorated methods
        const decoratedMethods = getDecoratedMethods(controller);
        for (const method of decoratedMethods) {
          try {
            await method.call(controller, error);
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
  }

  /**
   * Register feed controller
   */
  private registerFeedController(controller: any): void {
    this.on('feed', async (context: ChatContext) => {
      try {
        const { message, room, sender } = context;
        const senderName = await sender.getName();

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
        this.logger.debug(`Found ${messageHandlers.length} message handlers`);

        for (const handler of messageHandlers) {
          try {
            // Check room restrictions for message handlers
            if (
              !this.isRoomAllowed(
                controller,
                handler,
                context.room.getIdAsString()
              )
            ) {
              this.logger.debug(
                `Feed message handler ${handler.name} blocked by room restrictions`,
                {
                  roomId: context.room.getIdAsString(),
                  roomName: context.room.name,
                  handlerName: handler.name,
                  controllerName: controller.constructor.name,
                }
              );
              continue; // Skip this handler if room is not allowed
            }

            this.logger.debug(`Executing message handler: ${handler.name}`);
            await handler.call(controller, context);
          } catch (error) {
            this.logger.error('Error executing feed handler', error);
          }
        }

        // Execute all decorated methods
        const decoratedMethods = getDecoratedMethods(controller);
        this.logger.debug(`Found ${decoratedMethods.length} decorated methods`);

        for (const method of decoratedMethods) {
          try {
            // Check room restrictions for decorated methods
            if (
              !this.isRoomAllowed(
                controller,
                method,
                context.room.getIdAsString()
              )
            ) {
              this.logger.debug(
                `Feed decorated method ${method.name} blocked by room restrictions`,
                {
                  roomId: context.room.getIdAsString(),
                  roomName: context.room.name,
                  methodName: method.name,
                  controllerName: controller.constructor.name,
                }
              );
              continue; // Skip this method if room is not allowed
            }

            this.logger.debug(`Executing decorated method: ${method.name}`);
            await method.call(controller, context);
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
  }

  /**
   * Register unknown controller
   */
  private registerUnknownController(controller: any): void {
    this.on('unknown', async (context: ChatContext) => {
      try {
        // Execute all decorated methods
        const decoratedMethods = getDecoratedMethods(controller);
        for (const method of decoratedMethods) {
          try {
            // Check room restrictions for each method
            if (
              !this.isRoomAllowed(
                controller,
                method,
                context.room.getIdAsString()
              )
            ) {
              this.logger.debug(
                `Unknown method ${method.name} blocked by room restrictions`,
                {
                  roomId: context.room.getIdAsString(),
                  roomName: context.room.name,
                  methodName: method.name,
                  controllerName: controller.constructor.name,
                }
              );
              continue; // Skip this method if room is not allowed
            }

            await method.call(controller, context);
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
  }

  /**
   * Register chat controller
   */
  private registerChatController(controller: any): void {
    this.on('chat', async (context: ChatContext) => {
      try {
        // Execute all decorated methods
        const decoratedMethods = getDecoratedMethods(controller);
        for (const method of decoratedMethods) {
          try {
            // Check room restrictions for each method
            if (
              !this.isRoomAllowed(
                controller,
                method,
                context.room.getIdAsString()
              )
            ) {
              this.logger.debug(
                `Chat method ${method.name} blocked by room restrictions`,
                {
                  roomId: context.room.getIdAsString(),
                  roomName: context.room.name,
                  methodName: method.name,
                  controllerName: controller.constructor.name,
                }
              );
              continue; // Skip this method if room is not allowed
            }

            await method.call(controller, context);
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
  }

  /**
   * Get descriptive text for different message types
   */
  private getMessageTypeDescription(message: Message): string {
    // Handle image messages
    if (message.isImageMessage()) {
      if (message.isPhotoMessage()) {
        return 'Photo';
      } else if (message.isMultiPhotoMessage()) {
        return 'Multiple Photo (Legacy)';
      } else if (message.isNewMultiPhotoMessage()) {
        return 'Multiple Photo';
      }
    }

    // Handle other media types
    if (message.isVideoMessage()) {
      return 'Video';
    }

    if (message.isAudioMessage()) {
      return 'Audio';
    }

    if (message.isFileMessage()) {
      return 'File';
    }

    // Handle emoticons
    if (message.isEmoticonMessage()) {
      if (message.isOldEmoticonMessage()) {
        return 'Emoti (Old)';
      } else if (message.isBigEmoticonMessage()) {
        return 'Big Emoticon';
      } else if (message.isMobileEmoticonMessage()) {
        return 'Mobile Emoticon';
      } else if (message.isPCEmoticonMessage()) {
        return 'PC Emoticon';
      }
    }

    // Handle other message types
    if (message.isMapMessage()) {
      return 'Map';
    }

    if (message.isProfileMessage()) {
      return 'Profile';
    }

    if (message.isReplyMessage()) {
      return 'Reply';
    }

    // Fallback for unknown types
    return `Unknown message type: ${message.type}`;
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
