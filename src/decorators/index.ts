/**
 * TypeScript port of iris.decorators with enhanced functionality
 */

import { ChatContext } from '../types/models';
import { BatchScheduler } from '../services/BatchScheduler';

export type DecoratorHandler = (context: ChatContext) => void | Promise<void>;

// Throttle storage for rate limiting
const throttleStorage = new Map<string, Map<string, number[]>>();

// Command registry for bot commands
const commandRegistry = new Map<string, any>();

// Controller registry for auto-registration
const controllerRegistry = new Map<string, any[]>();

// Batch controller registry
const batchControllerRegistry = new Map<string, any[]>();

// Bootstrap controller registry
const bootstrapControllerRegistry = new Map<string, any[]>();

// Prefix storage for controllers and methods
const controllerPrefixStorage = new Map<Function, string>();
const methodPrefixStorage = new Map<Function, string>();

// Decorator metadata storage
export const decoratorMetadata = new Map<
  Function,
  { commands: string[]; hasDecorators: boolean; isMessageHandler?: boolean }
>();

/**
 * Helper function to register a controller for an event type
 */
function registerController(eventType: string, constructor: any) {
  const existing = controllerRegistry.get(eventType) || [];
  existing.push(constructor);
  controllerRegistry.set(eventType, existing);
}

/**
 * Class decorator for MessageController
 */
export function MessageController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('message', constructor);
  return constructor;
}

/**
 * Class decorator for NewMemberController
 */
export function NewMemberController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('new_member', constructor);
  return constructor;
}

/**
 * Class decorator for DeleteMemberController
 */
export function DeleteMemberController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('del_member', constructor);
  return constructor;
}

/**
 * Class decorator for ErrorController
 */
export function ErrorController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('error', constructor);
  return constructor;
}

/**
 * Class decorator for FeedController
 */
export function FeedController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('feed', constructor);
  return constructor;
}

/**
 * Class decorator for UnknownController
 */
export function UnknownController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('unknown', constructor);
  return constructor;
}

/**
 * Class decorator for ChatController (handles all chat events)
 */
export function ChatController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('chat', constructor);
  return constructor;
}

/**
 * Prefix decorator for classes (sets default prefix for all commands in the controller)
 */
export function Prefix(prefix: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    controllerPrefixStorage.set(constructor, prefix);
    return constructor;
  };
}

/**
 * Prefix decorator for methods (sets prefix for specific command, overrides class prefix)
 */
export function MethodPrefix(prefix: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    methodPrefixStorage.set(originalMethod, prefix);
    return descriptor;
  };
}

/**
 * Command decorator for marking methods as event handlers
 * Required for DeleteMemberController, ErrorController, FeedController, NewMemberController, UnknownController
 */
export function Command(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  // Mark as decorated method for controller scanning
  const metadata = decoratorMetadata.get(originalMethod) || {
    commands: [],
    hasDecorators: false,
  };
  metadata.hasDecorators = true;
  decoratorMetadata.set(originalMethod, metadata);

  return descriptor;
}

/**
 * Helper function to create message handler decorators
 */
function createMessageHandlerDecorator(
  condition: (context: ChatContext) => boolean
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (context: ChatContext) {
      if (!condition(context)) {
        return;
      }

      return originalMethod.call(this, context);
    };

    // Register metadata using function properties
    const metadata = {
      commands: [],
      hasDecorators: true,
      isMessageHandler: true,
    };

    // Set metadata as function property (more reliable)
    (descriptor.value as any).__decoratorMetadata = metadata;

    // Also set in the Map for backward compatibility
    decoratorMetadata.set(originalMethod, metadata);
    decoratorMetadata.set(descriptor.value, metadata);

    return descriptor;
  };
}

/**
 * Decorator that executes on every message (regardless of command)
 * Useful for logging, monitoring, or general message processing
 */
export function OnMessage(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  // Register this method as a message handler (no filtering)
  const metadata = {
    commands: [],
    hasDecorators: true,
    isMessageHandler: true,
  };

  // Set metadata as function property (more reliable)
  (originalMethod as any).__decoratorMetadata = metadata;

  // Also set in the Map for backward compatibility
  decoratorMetadata.set(originalMethod, metadata);

  return descriptor;
}

/**
 * Decorator that executes only on normal text messages (type 1)
 */
export const OnNormalMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isNormalMessage()
);

/**
 * Decorator that executes only on photo messages (type 2)
 */
export const OnPhotoMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isPhotoMessage()
);

/**
 * Decorator that executes only on video messages (type 3)
 */
export const OnVideoMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isVideoMessage()
);

/**
 * Decorator that executes only on audio messages (type 5)
 */
export const OnAudioMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isAudioMessage()
);

/**
 * Decorator that executes only on emoticon messages (types 6, 12, 20, 25)
 */
export const OnEmoticonMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isEmoticonMessage()
);

/**
 * Decorator that executes only on map/location messages (type 16)
 */
export const OnMapMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isMapMessage()
);

/**
 * Decorator that executes only on profile messages (type 17)
 */
export const OnProfileMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isProfileMessage()
);

/**
 * Decorator that executes only on file messages (type 18)
 */
export const OnFileMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isFileMessage()
);

/**
 * Decorator that executes only on reply messages (type 26)
 */
export const OnReplyMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isReplyMessage()
);

/**
 * Decorator that executes only on multi-photo messages (type 27 - legacy)
 */
export const OnMultiPhotoMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isMultiPhotoMessage()
);

/**
 * Decorator that executes only on new multi-photo messages (type 71 - modern)
 */
export const OnNewMultiPhotoMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isNewMultiPhotoMessage()
);

/**
 * Decorator that executes only on any image messages (types 2, 27, 71)
 */
export const OnImageMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isImageMessage()
);

/**
 * Decorator that executes only on feed messages
 */
export const OnFeedMessage = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isFeedMessage()
);

/**
 * Decorator that executes only on user invite feed messages
 */
export const OnInviteUserFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isInviteUserFeed()
);

/**
 * Decorator that executes only on user leave feed messages
 */
export const OnLeaveUserFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isLeaveUserFeed()
);

/**
 * Decorator that executes only on open chat join feed messages
 */
export const OnOpenChatJoinUserFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isOpenChatJoinUserFeed()
);

/**
 * Decorator that executes only on open chat kicked user feed messages
 */
export const OnOpenChatKickedUserFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isOpenChatKickedUserFeed()
);

/**
 * Decorator that executes only on manager promotion feed messages
 */
export const OnPromoteManagerFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isOpenChatPromoteManagerFeed()
);

/**
 * Decorator that executes only on manager demotion feed messages
 */
export const OnDemoteManagerFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isOpenChatDemoteManagerFeed()
);

/**
 * Decorator that executes only on delete message feed messages
 */
export const OnDeleteMessageFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isDeleteMessageFeed()
);

/**
 * Decorator that executes only on host handover feed messages
 */
export const OnHandOverHostFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isOpenChatHandOverHostFeed()
);

/**
 * Decorator that executes only on hide message feed messages
 */
export const OnHideMessageFeed = createMessageHandlerDecorator(
  (context: ChatContext) => context.message.isOpenChatHideMessageFeed()
);

/**
 * Decorator that only executes if message has parameters
 */
export function HasParam(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (context: ChatContext) {
    if (!context.message.hasParam) {
      return;
    }

    return originalMethod.call(this, context);
  };

  // Mark as decorated
  const metadata = decoratorMetadata.get(originalMethod) || {
    commands: [],
    hasDecorators: false,
  };
  metadata.hasDecorators = true;
  decoratorMetadata.set(originalMethod, metadata);

  return descriptor;
}

/**
 * Decorator that only executes if message is a reply
 */
export function IsReply(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (context: ChatContext) {
    // Check if message is a reply by looking at message structure
    const isMessageReply =
      context.raw.attachment &&
      typeof context.raw.attachment === 'object' &&
      context.raw.attachment.reply;

    if (!isMessageReply) {
      await context.reply('Please reply to a message to make this request.');
      return;
    }

    return originalMethod.call(this, context);
  };

  return descriptor;
}

/**
 * Decorator that only executes if user has specific roles
 * @param allowedRoles - 허용된 역할 배열
 * @param callback - 권한이 없을 때 실행될 콜백 함수
 */
export function HasRole(
  allowedRoles: string[],
  callback?: (
    context: ChatContext,
    allowedRoles: string[],
    userRole: string | null
  ) => Promise<void>
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (context: ChatContext) {
      const userType = await context.sender.getType();

      if (!userType || !allowedRoles.includes(userType)) {
        if (callback) {
          await callback(context, allowedRoles, userType);
          return;
        }
        // 콜백이 없으면 기존 동작 유지 (아무것도 하지 않음)
        return;
      }

      return originalMethod.call(this, context);
    };

    return descriptor;
  };
}

/**
 * Decorator that only executes if user is admin (HOST or MANAGER)
 */
export function IsAdmin(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (context: ChatContext) {
    const userType = await context.sender.getType();

    if (userType !== 'HOST' && userType !== 'MANAGER') {
      return;
    }

    return originalMethod.call(this, context);
  };

  return descriptor;
}

/**
 * Decorator that only executes if user is not banned
 */
export function IsNotBanned(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (context: ChatContext) {
    const isBanned = await checkIfUserIsBanned(context.sender.id);

    if (isBanned) {
      return;
    }

    return originalMethod.call(this, context);
  };

  return descriptor;
}

/**
 * Decorator for bot commands with automatic command matching
 */
export function BotCommand(commands: string | string[], description?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    // Normalize commands to array
    const commandArray = Array.isArray(commands) ? commands : [commands];

    // Store metadata for controller scanning
    const metadata = decoratorMetadata.get(originalMethod) || {
      commands: [],
      hasDecorators: false,
    };

    // Add all commands to metadata
    metadata.commands.push(...commandArray);
    metadata.hasDecorators = true;
    decoratorMetadata.set(originalMethod, metadata);

    // Register each command individually for help system and execution
    for (const command of commandArray) {
      commandRegistry.set(command, {
        method: propertyKey,
        target: target.constructor.name,
        originalCommand: command,
        originalMethod: originalMethod,
        description: description,
        allCommands: commandArray, // Store all alternative commands
      });
    }

    return descriptor;
  };
}

/**
 * Decorator for help commands that automatically generates help text from registered commands
 */
export function HelpCommand(command: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (context: ChatContext) {
      // Get bot instance for bot name
      const { Bot } = await import('../services/Bot');
      const bot = Bot.getInstance();
      const botName = bot?.name || '봇';

      // Generate help text from registered commands
      const commands = getRegisteredCommands();
      const helpLines: string[] = [];

      // Add header with bot name
      helpLines.push(`${botName} 도움말`);
      helpLines.push('\u200b'.repeat(500));

      // Group commands by method to avoid duplicates
      const commandGroups = new Map<string, any>();

      for (const [baseCommand, commandInfo] of commands) {
        const methodKey = `${commandInfo.target}.${commandInfo.method}`;

        if (!commandGroups.has(methodKey)) {
          commandGroups.set(methodKey, {
            commands: [],
            description: commandInfo.description || '설명 없음',
            originalMethod: commandInfo.originalMethod,
            target: commandInfo.target,
          });
        }

        commandGroups.get(methodKey)!.commands.push(baseCommand);
      }

      // Collect all command groups and sort them
      const allCommandGroups: any[] = [];
      for (const [methodKey, groupInfo] of commandGroups) {
        // Get full commands with prefix for this controller
        const fullCommands = groupInfo.commands.map((baseCommand: string) =>
          getFullCommand(
            target.constructor,
            groupInfo.originalMethod,
            baseCommand
          )
        );

        // Sort commands within the group
        fullCommands.sort();

        allCommandGroups.push({
          fullCommands,
          description: groupInfo.description,
          primaryCommand: fullCommands[0], // Use first command for sorting
        });
      }

      // Sort command groups alphabetically by primary command
      allCommandGroups.sort((a, b) =>
        a.primaryCommand.localeCompare(b.primaryCommand)
      );

      // Build help text in clean format
      for (const group of allCommandGroups) {
        if (group.fullCommands.length === 1) {
          // Single command
          helpLines.push(`${group.fullCommands[0]}`);
        } else {
          // Multiple commands - show alternatives
          helpLines.push(`${group.fullCommands.join(' | ')}`);
        }
        helpLines.push(` ⌊ ${group.description}`);
        helpLines.push('');
      }

      // If no commands found, show a default message
      if (allCommandGroups.length === 0) {
        helpLines.push('등록된 명령어가 없습니다.');
      } else {
        // Remove last empty line
        if (helpLines[helpLines.length - 1] === '') {
          helpLines.pop();
        }
      }

      const helpText = helpLines.join('\n');
      await context.reply(helpText);
    };

    // Store metadata for controller scanning
    const metadata = decoratorMetadata.get(originalMethod) || {
      commands: [],
      hasDecorators: false,
    };

    // Store the original command without prefix for metadata
    metadata.commands.push(command);
    metadata.hasDecorators = true;
    decoratorMetadata.set(originalMethod, metadata);

    // Register help command
    commandRegistry.set(command, {
      method: propertyKey,
      target: target.constructor.name,
      originalCommand: command,
      originalMethod: originalMethod,
      description: '도움말 표시',
    });

    return descriptor;
  };
}

/**
 * Helper function to get the full command with prefix for a controller and method
 */
export function getFullCommand(
  controllerConstructor: Function,
  methodFunction: Function,
  baseCommand: string
): string {
  let prefix = '';

  // Method prefix overrides controller prefix
  const methodPrefix = methodPrefixStorage.get(methodFunction);
  if (methodPrefix !== undefined) {
    prefix = methodPrefix;
  } else {
    const controllerPrefix = controllerPrefixStorage.get(controllerConstructor);
    if (controllerPrefix !== undefined) {
      prefix = controllerPrefix;
    }
  }

  return prefix + baseCommand;
}

/**
 * Helper function to check if a message matches a command
 */
export function isCommandMatch(
  messageText: string,
  fullCommand: string
): boolean {
  if (typeof messageText !== 'string') {
    return false;
  }

  // Exact match or command followed by space (for parameters)
  return (
    messageText === fullCommand || messageText.startsWith(fullCommand + ' ')
  );
}

/**
 * Decorator for throttling commands (rate limiting)
 * @param maxCalls - 최대 호출 횟수
 * @param windowMs - 시간 창 (밀리초)
 * @param callback - 제한 시 실행될 콜백 함수
 */
export function Throttle(
  maxCalls: number,
  windowMs: number,
  callback?: (
    context: ChatContext,
    maxCalls: number,
    windowMs: number,
    msUntilNext: number
  ) => Promise<void>
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (context: ChatContext) {
      const userId = context.sender.id;
      const methodKey = `room${context.room.id}.${target.constructor.name}.${propertyKey}`;
      const now = Date.now();

      if (!throttleStorage.has(methodKey)) {
        throttleStorage.set(methodKey, new Map<string, number[]>());
      }

      const userThrottle = throttleStorage.get(methodKey)!;
      const userCalls = userThrottle.get(userId) || [];

      // Remove calls outside the window
      const validCalls = userCalls.filter(
        (callTime: number) => now - callTime < windowMs
      );

      if (validCalls.length >= maxCalls) {
        // Calculate next available time (oldest call + window)
        const oldestCall = Math.min(...validCalls);
        const nextAvailableTime = oldestCall + windowMs;
        const msUntilNext = nextAvailableTime - now;
        if (callback) {
          await callback(context, maxCalls, windowMs, msUntilNext);
          return;
        } else {
          const secondsUntilNext = Math.ceil(msUntilNext / 1000);
          await context.reply(
            `⏱️ 명령어 사용 제한: ${windowMs / 1000}초 내에 최대 ${maxCalls}번만 사용 가능합니다.\n 다음 사용 가능 시간: ${secondsUntilNext}초 후`
          );
          return;
        }
      }

      // Add current call
      validCalls.push(now);
      userThrottle.set(userId, validCalls);

      return originalMethod.call(this, context);
    };

    return descriptor;
  };
}

/**
 * Helper function to check if user is banned
 */
async function checkIfUserIsBanned(userId: string): Promise<boolean> {
  try {
    const { Config } = await import('../utils/config');
    const config = Config.getInstance();
    const bannedUsers = config.bannedUsers;
    return bannedUsers.includes(userId);
  } catch {
    return false;
  }
}

/**
 * Get all registered commands
 */
export function getRegisteredCommands(): Map<string, any> {
  return commandRegistry;
}

/**
 * Get all registered message handlers (OnMessage decorators)
 */
export function getMessageHandlers(controllerInstance: any): Function[] {
  const handlers: Function[] = [];

  // Get all methods from the controller instance
  const prototype = Object.getPrototypeOf(controllerInstance);
  const methodNames = Object.getOwnPropertyNames(prototype);

  for (const methodName of methodNames) {
    const method = prototype[methodName];
    if (typeof method === 'function' && method !== prototype.constructor) {
      // Check both Map-based metadata and function property metadata
      const mapMetadata = decoratorMetadata.get(method);
      const funcMetadata = (method as any).__decoratorMetadata;

      const metadata = mapMetadata || funcMetadata;

      if (metadata && metadata.isMessageHandler) {
        handlers.push(method.bind(controllerInstance));
      }
    }
  }

  return handlers;
}

/**
 * Debug function to inspect decorator metadata
 */
export function debugDecoratorMetadata(controllerInstance: any): void {
  // Force enable debug logging by creating a temporary winston logger
  const winston = require('winston');
  const debugLogger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message }: any) => {
        return `[${timestamp}] [${level}] [DecoratorMetadata] ${message}`;
      })
    ),
    transports: [new winston.transports.Console()],
  });

  debugLogger.debug(
    `\n=== DEBUG Decorator Metadata for ${controllerInstance.constructor.name} ===`
  );

  const prototype = Object.getPrototypeOf(controllerInstance);
  const methodNames = Object.getOwnPropertyNames(prototype);

  debugLogger.debug(`Total methods found: ${methodNames.length}`);
  debugLogger.debug(`Methods: ${methodNames.join(', ')}`);

  debugLogger.debug(`\nDecoratorMetadata Map size: ${decoratorMetadata.size}`);
  debugLogger.debug('All decoratorMetadata entries:');
  let entryIndex = 0;
  for (const [func, metadata] of decoratorMetadata.entries()) {
    debugLogger.debug(`  Entry ${entryIndex++}: ${func.name} ->`, metadata);
  }

  for (const methodName of methodNames) {
    const method = prototype[methodName];
    if (typeof method === 'function' && method !== prototype.constructor) {
      const mapMetadata = decoratorMetadata.get(method);
      const funcMetadata = (method as any).__decoratorMetadata;

      debugLogger.debug(`\nMethod: ${methodName}`);
      debugLogger.debug(`  Function reference: ${method.name}`);
      debugLogger.debug(`  Map Metadata: ${JSON.stringify(mapMetadata)}`);
      debugLogger.debug(
        `  Function Property Metadata: ${JSON.stringify(funcMetadata)}`
      );
      debugLogger.debug(
        `  Has isMessageHandler (Map): ${mapMetadata?.isMessageHandler === true}`
      );
      debugLogger.debug(
        `  Has isMessageHandler (Property): ${funcMetadata?.isMessageHandler === true}`
      );

      // Check if the method has been wrapped by decorator
      debugLogger.debug(
        `  Function toString preview: ${method.toString().substring(0, 100)}...`
      );
    }
  }

  debugLogger.debug('=== END DEBUG Decorator Metadata ===\n');
}

/**
 * Get all registered controllers
 */
export function getRegisteredControllers(): Map<string, any[]> {
  return controllerRegistry;
}

/**
 * Clear throttle data for a specific user (useful for admin commands)
 */
export function clearUserThrottle(userId: string): void {
  throttleStorage.forEach((methodMap) => {
    methodMap.delete(userId);
  });
}

/**
 * Clear all throttle data
 */
export function clearAllThrottle(): void {
  throttleStorage.clear();
}

/**
 * Function-based decorators for easier use (backward compatibility)
 */
export const decorators = {
  hasParam: (handler: DecoratorHandler): DecoratorHandler => {
    return async (context: ChatContext) => {
      if (!context.message.hasParam) {
        return;
      }
      return handler(context);
    };
  },

  isReply: (handler: DecoratorHandler): DecoratorHandler => {
    return async (context: ChatContext) => {
      const isMessageReply =
        context.raw.attachment &&
        typeof context.raw.attachment === 'object' &&
        context.raw.attachment.reply;

      if (!isMessageReply) {
        await context.reply('Please reply to a message to make this request.');
        return;
      }

      return handler(context);
    };
  },

  isAdmin: (handler: DecoratorHandler): DecoratorHandler => {
    return async (context: ChatContext) => {
      const userType = await context.sender.getType();

      if (userType !== 'HOST' && userType !== 'MANAGER') {
        return;
      }

      return handler(context);
    };
  },

  isNotBanned: (handler: DecoratorHandler): DecoratorHandler => {
    return async (context: ChatContext) => {
      const isBanned = await checkIfUserIsBanned(context.sender.id);

      if (isBanned) {
        return;
      }

      return handler(context);
    };
  },
};

// Backward compatibility exports
export const hasParam = decorators.hasParam;
export const isReply = decorators.isReply;
export const isAdmin = decorators.isAdmin;
export const isNotBanned = decorators.isNotBanned;

/**
 * Get the prefix for a controller class
 */
export function getControllerPrefix(constructor: Function): string | undefined {
  return controllerPrefixStorage.get(constructor);
}

/**
 * Get the prefix for a method
 */
export function getMethodPrefix(method: Function): string | undefined {
  return methodPrefixStorage.get(method);
}

/**
 * Set controller prefix programmatically
 */
export function setControllerPrefix(
  constructor: Function,
  prefix: string
): void {
  controllerPrefixStorage.set(constructor, prefix);
}

/**
 * Set method prefix programmatically
 */
export function setMethodPrefix(method: Function, prefix: string): void {
  methodPrefixStorage.set(method, prefix);
}

/**
 * Clear all prefix data
 */
export function clearAllPrefixes(): void {
  controllerPrefixStorage.clear();
  methodPrefixStorage.clear();
}

/**
 * Get methods with @Command decorator from a controller instance
 */
export function getDecoratedMethods(controller: any): Function[] {
  const methods: Function[] = [];
  const prototype = Object.getPrototypeOf(controller);
  const methodNames = Object.getOwnPropertyNames(prototype);

  for (const methodName of methodNames) {
    if (methodName === 'constructor') continue;

    const method = controller[methodName];
    if (typeof method === 'function') {
      const boundMethod = method.bind(controller);

      // Check if method has @Command decorator
      const metadata = decoratorMetadata.get(method);
      if (metadata && metadata.hasDecorators) {
        methods.push(boundMethod);
      }
    }
  }

  return methods;
}

// ===== BATCH SCHEDULING DECORATORS =====

/**
 * Class decorator for BatchController
 */
export function BatchController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('batch', constructor);

  // Also register in batch controller registry
  const existing = batchControllerRegistry.get('batch') || [];
  existing.push(constructor);
  batchControllerRegistry.set('batch', existing);

  return constructor;
}

/**
 * Class decorator for BootstrapController
 */
export function BootstrapController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  registerController('bootstrap', constructor);

  // Also register in bootstrap controller registry
  const existing = bootstrapControllerRegistry.get('bootstrap') || [];
  existing.push(constructor);
  bootstrapControllerRegistry.set('bootstrap', existing);

  return constructor;
}

/**
 * Schedule decorator for batch processing at intervals or using cron expressions
 * @param intervalOrCron - 실행 간격(밀리초) 또는 cron 표현식
 * @param scheduleId - 스케줄 ID (선택사항, 메서드명을 기본값으로 사용)
 */
export function Schedule(intervalOrCron: number | string, scheduleId?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const id = scheduleId || `${target.constructor.name}.${propertyKey}`;

    // 메타데이터 저장 (실제 등록은 Bot에서 수행)
    const metadata = decoratorMetadata.get(originalMethod) || {
      commands: [],
      hasDecorators: false,
    };
    metadata.hasDecorators = true;
    (metadata as any).scheduleId = id;

    if (typeof intervalOrCron === 'number') {
      (metadata as any).scheduleInterval = intervalOrCron;
    } else {
      (metadata as any).scheduleCron = intervalOrCron;
    }

    // Set metadata as function property
    (originalMethod as any).__decoratorMetadata = metadata;
    decoratorMetadata.set(originalMethod, metadata);
  };
}

/**
 * ScheduleMessage decorator for timed message scheduling
 * @param key - 스케줄 키 (메시지 그룹 식별자)
 */
export function ScheduleMessage(key: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    // 메타데이터 저장
    const metadata = decoratorMetadata.get(originalMethod) || {
      commands: [],
      hasDecorators: false,
    };
    metadata.hasDecorators = true;
    (metadata as any).scheduleMessageKey = key;

    // Set metadata as function property
    (originalMethod as any).__decoratorMetadata = metadata;
    decoratorMetadata.set(originalMethod, metadata);
  };
}

/**
 * Bootstrap decorator for initialization methods
 * @param priority - 실행 우선순위 (높을수록 먼저 실행)
 */
export function Bootstrap(priority: number = 0) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    // 메타데이터 저장 (실제 등록은 Bot에서 수행)
    const metadata = decoratorMetadata.get(originalMethod) || {
      commands: [],
      hasDecorators: false,
    };
    metadata.hasDecorators = true;
    (metadata as any).bootstrapPriority = priority;

    // Set metadata as function property
    (originalMethod as any).__decoratorMetadata = metadata;
    decoratorMetadata.set(originalMethod, metadata);
  };
}

/**
 * Room decorator for restricting execution to specific rooms
 * @param roomIds - 허용된 방 ID 배열
 */
export function AllowedRoom(roomIds: string[]) {
  return function (
    target: any,
    propertyKey?: string,
    descriptor?: PropertyDescriptor
  ) {
    if (propertyKey && descriptor) {
      // 메서드 레벨 데코레이터
      const originalMethod = descriptor.value;

      const metadata = decoratorMetadata.get(originalMethod) || {
        commands: [],
        hasDecorators: false,
      };
      metadata.hasDecorators = true;
      (metadata as any).allowedRooms = roomIds;

      decoratorMetadata.set(originalMethod, metadata);
    } else {
      // 클래스 레벨 데코레이터
      (target as any).__allowedRooms = roomIds;
    }
  };
}

/**
 * Helper function to get batch controllers
 */
export function getBatchControllers(): Map<string, any[]> {
  return batchControllerRegistry;
}

/**
 * Helper function to get bootstrap controllers
 */
export function getBootstrapControllers(): Map<string, any[]> {
  return bootstrapControllerRegistry;
}

/**
 * Helper function to get schedule methods from a controller
 */
export function getScheduleMethods(controller: any): Array<{
  method: Function;
  scheduleId: string;
  interval?: number;
  cronExpression?: string;
}> {
  const methods: Array<{
    method: Function;
    scheduleId: string;
    interval?: number;
    cronExpression?: string;
  }> = [];

  const prototype = Object.getPrototypeOf(controller);
  const methodNames = Object.getOwnPropertyNames(prototype);

  for (const methodName of methodNames) {
    if (methodName === 'constructor') continue;

    const method = controller[methodName];
    if (typeof method === 'function') {
      const metadata = decoratorMetadata.get(method);
      if (metadata && (metadata as any).scheduleId) {
        methods.push({
          method: method.bind(controller),
          scheduleId: (metadata as any).scheduleId,
          interval: (metadata as any).scheduleInterval,
          cronExpression: (metadata as any).scheduleCron,
        });
      }
    }
  }

  return methods;
}

/**
 * Helper function to get schedule message methods from a controller
 */
export function getScheduleMessageMethods(controller: any): Array<{
  method: Function;
  key: string;
}> {
  const methods: Array<{
    method: Function;
    key: string;
  }> = [];

  const prototype = Object.getPrototypeOf(controller);
  const methodNames = Object.getOwnPropertyNames(prototype);

  for (const methodName of methodNames) {
    if (methodName === 'constructor') continue;

    const method = controller[methodName];
    if (typeof method === 'function') {
      const metadata = decoratorMetadata.get(method);
      if (metadata && (metadata as any).scheduleMessageKey) {
        methods.push({
          method: method.bind(controller),
          key: (metadata as any).scheduleMessageKey,
        });
      }
    }
  }

  return methods;
}

/**
 * Helper function to get bootstrap methods from a controller
 */
export function getBootstrapMethods(controller: any): Array<{
  method: Function;
  priority: number;
}> {
  const methods: Array<{
    method: Function;
    priority: number;
  }> = [];

  const prototype = Object.getPrototypeOf(controller);
  const methodNames = Object.getOwnPropertyNames(prototype);

  for (const methodName of methodNames) {
    if (methodName === 'constructor') continue;

    const method = controller[methodName];
    if (typeof method === 'function') {
      const metadata = decoratorMetadata.get(method);
      if (metadata && typeof (metadata as any).bootstrapPriority === 'number') {
        methods.push({
          method: method.bind(controller),
          priority: (metadata as any).bootstrapPriority,
        });
      }
    }
  }

  return methods;
}

/**
 * Helper function to add context to schedule
 */
export function addContextToSchedule(
  scheduleId: string,
  context: ChatContext
): void {
  const scheduler = BatchScheduler.getInstance();
  scheduler.addContextToSchedule(scheduleId, context);
}

/**
 * Helper function to schedule a message
 */
export function scheduleMessage(
  id: string,
  roomId: string,
  message: string,
  scheduledTime: number,
  metadata?: any
): void {
  const scheduler = BatchScheduler.getInstance();
  scheduler.scheduleMessage(id, roomId, message, scheduledTime, metadata);
}
