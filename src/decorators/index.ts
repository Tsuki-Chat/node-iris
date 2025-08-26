/**
 * TypeScript port of iris.decorators
 */

import { ChatContext } from '../types/models';

export type DecoratorHandler = (context: ChatContext) => void | Promise<void>;

/**
 * Decorator that only executes if message has parameters
 */
export function hasParam(
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

  return descriptor;
}

/**
 * Decorator that only executes if message is a reply
 */
export function isReply(
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
      await context.reply('메세지에 답장하여 요청하세요.');
      return;
    }

    return originalMethod.call(this, context);
  };

  return descriptor;
}

/**
 * Decorator that only executes if user is admin (HOST or MANAGER)
 */
export function isAdmin(
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
 * Note: This implementation would need to integrate with your ban system
 * For now, it's a placeholder that always allows execution
 */
export function isNotBanned(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (context: ChatContext) {
    // TODO: Implement ban checking logic
    // This would typically check against environment variables or a database
    const isBanned = await checkIfUserIsBanned(context.sender.id);

    if (isBanned) {
      return;
    }

    return originalMethod.call(this, context);
  };

  return descriptor;
}

/**
 * Helper function to check if user is banned
 * This is a placeholder - implement based on your ban system
 */
async function checkIfUserIsBanned(userId: number): Promise<boolean> {
  // Get banned users from environment variable or configuration
  const { Config } = await import('../utils/config');
  const config = Config.getInstance();
  const bannedUsers = config.bannedUsers;
  return bannedUsers.includes(userId);
}

/**
 * Function-based decorators for easier use
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
        await context.reply('메세지에 답장하여 요청하세요.');
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
      const { Config } = await import('../utils/config');
      const config = Config.getInstance();
      const bannedUsers = config.bannedUsers;
      const isBanned = bannedUsers.includes(context.sender.id);

      if (isBanned) {
        return;
      }

      return handler(context);
    };
  },
};
