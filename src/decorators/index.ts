/**
 * TypeScript port of iris.decorators with enhanced functionality
 */

import { ChatContext } from '../types/models';
import { Logger } from '../utils/logger';

export type DecoratorHandler = (context: ChatContext) => void | Promise<void>;

// Throttle storage for rate limiting
const throttleStorage = new Map<string, Map<string, number[]>>();

// Command registry for bot commands
const commandRegistry = new Map<string, any>();

// Controller registry for auto-registration
const controllerRegistry = new Map<string, any[]>();

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
 */
export function HasRole(allowedRoles: string[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (context: ChatContext) {
      const userType = await context.sender.getType();

      if (!userType || !allowedRoles.includes(userType)) {
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
export function BotCommand(command: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (context: ChatContext) {
      // Get prefix - method prefix overrides controller prefix
      let prefix = '';
      const methodPrefix = methodPrefixStorage.get(originalMethod);
      if (methodPrefix !== undefined) {
        prefix = methodPrefix;
      } else {
        const controllerPrefix = controllerPrefixStorage.get(
          target.constructor
        );
        if (controllerPrefix !== undefined) {
          prefix = controllerPrefix;
        }
      }

      // Build full command with prefix
      const fullCommand = prefix + command;

      if (
        context.message.msg !== fullCommand &&
        typeof context.message.msg === 'string' &&
        !context.message.msg.startsWith(fullCommand + ' ')
      ) {
        return;
      }

      return originalMethod.call(this, context);
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

    // Register command for help system (with prefix resolution)
    let prefix = '';
    const methodPrefix = methodPrefixStorage.get(originalMethod);
    if (methodPrefix !== undefined) {
      prefix = methodPrefix;
    } else {
      const controllerPrefix = controllerPrefixStorage.get(target.constructor);
      if (controllerPrefix !== undefined) {
        prefix = controllerPrefix;
      }
    }

    const fullCommand = prefix + command;
    commandRegistry.set(fullCommand, {
      method: propertyKey,
      target: target.constructor.name,
      originalCommand: command,
      prefix: prefix,
    });

    return descriptor;
  };
}

/**
 * Decorator for throttling commands (rate limiting)
 */
export function Throttle(maxCalls: number, windowMs: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (context: ChatContext) {
      const userId = context.sender.id;
      const methodKey = `${target.constructor.name}.${propertyKey}`;
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
        await context.reply(
          `⏱️ 명령어 사용 제한: ${windowMs / 1000}초 내에 최대 ${maxCalls}번만 사용 가능합니다.`
        );
        return;
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
  const logger = new Logger('DecoratorMetadata');
  logger.debug(
    `\n=== DEBUG Decorator Metadata for ${controllerInstance.constructor.name} ===`
  );

  const prototype = Object.getPrototypeOf(controllerInstance);
  const methodNames = Object.getOwnPropertyNames(prototype);

  logger.debug(`Total methods found: ${methodNames.length}`);
  logger.debug(`Methods: ${methodNames.join(', ')}`);

  logger.debug(`\nDecoratorMetadata Map size: ${decoratorMetadata.size}`);
  logger.debug('All decoratorMetadata entries:');
  let entryIndex = 0;
  for (const [func, metadata] of decoratorMetadata.entries()) {
    logger.debug(`  Entry ${entryIndex++}: ${func.name} ->`, metadata);
  }

  for (const methodName of methodNames) {
    const method = prototype[methodName];
    if (typeof method === 'function' && method !== prototype.constructor) {
      const mapMetadata = decoratorMetadata.get(method);
      const funcMetadata = (method as any).__decoratorMetadata;

      logger.debug(`\nMethod: ${methodName}`);
      logger.debug(`  Function reference: ${method.name}`);
      logger.debug(`  Map Metadata: ${JSON.stringify(mapMetadata)}`);
      logger.debug(
        `  Function Property Metadata: ${JSON.stringify(funcMetadata)}`
      );
      logger.debug(
        `  Has isMessageHandler (Map): ${mapMetadata?.isMessageHandler === true}`
      );
      logger.debug(
        `  Has isMessageHandler (Property): ${funcMetadata?.isMessageHandler === true}`
      );

      // Check if the method has been wrapped by decorator
      logger.debug(
        `  Function toString preview: ${method.toString().substring(0, 100)}...`
      );
    }
  }

  logger.debug('=== END DEBUG Decorator Metadata ===\n');
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
