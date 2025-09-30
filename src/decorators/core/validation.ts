/**
 * Validation decorators for parameter, role, and permission checking
 */

import { ChatContext } from '@/types/models';
import type { DecoratorHandler } from './base';
import { throttleStorage } from './base';

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
    if (!context.message.isReplyMessage()) {
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
    const isBanned = await checkIfUserIsBanned(context.sender.getIdAsString());

    if (isBanned) {
      return;
    }

    return originalMethod.call(this, context);
  };

  return descriptor;
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
      const userId = context.sender.getIdAsString();
      const methodKey = `room${context.room.getIdAsString()}.${target.constructor.name}.${propertyKey}`;
      const now = Date.now();

      if (!throttleStorage.has(methodKey)) {
        throttleStorage.set(methodKey, new Map<string, number[]>());
      }

      const userThrottle = throttleStorage.get(methodKey)!;
      const userCalls = userThrottle.get(userId) || [];

      // Remove calls outside the window
      const validCalls = userCalls.filter(
        (callTime) => now - callTime < windowMs
      );

      if (validCalls.length >= maxCalls) {
        // User has exceeded the limit
        if (callback) {
          const oldestCall = Math.min(...validCalls);
          const msUntilNext = windowMs - (now - oldestCall);
          await callback(context, maxCalls, windowMs, msUntilNext);
        }
        return;
      }

      // Add current call and update storage
      validCalls.push(now);
      userThrottle.set(userId, validCalls);

      return originalMethod.call(this, context);
    };

    return descriptor;
  };
}

/**
 * Room decorator for restricting execution to specific rooms
 * @param roomIds - 허용된 방 ID 배열
 */
export function AllowedRoom(roomIds: string[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (context: ChatContext) {
      const currentRoomId = context.room.getIdAsString();

      // Check if current room is in allowed rooms
      if (!roomIds.includes(currentRoomId)) {
        return; // Silently ignore if room is not allowed
      }

      return originalMethod.call(this, context);
    };

    // Store room restrictions in multiple ways for compatibility
    (descriptor.value as any).__allowedRooms = roomIds;

    // Also store in decorator metadata for consistency
    (descriptor.value as any).__decoratorMetadata = {
      ...(descriptor.value as any).__decoratorMetadata,
      allowedRooms: roomIds,
    };

    return descriptor;
  };
}

/**
 * Helper function to check if user is banned
 */
async function checkIfUserIsBanned(userId: string): Promise<boolean> {
  // Placeholder implementation - you can extend this with actual ban checking logic
  // For example, check against a database or cache
  const bannedUsers: string[] = []; // Load from your ban system
  return bannedUsers.includes(userId);
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
      if (!context.message.isReplyMessage()) {
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
      const isBanned = await checkIfUserIsBanned(
        context.sender.getIdAsString()
      );

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
 * Debug function to check room restrictions for a method
 */
export function debugRoomRestrictions(
  method: Function,
  controllerConstructor?: Function
): void {
  console.log('=== Room Restrictions Debug ===');
  console.log('Method:', method.name);

  if ((method as any).__allowedRooms) {
    console.log('Method-level restrictions:', (method as any).__allowedRooms);
  }

  if ((method as any).__decoratorMetadata?.allowedRooms) {
    console.log(
      'Decorator metadata restrictions:',
      (method as any).__decoratorMetadata.allowedRooms
    );
  }

  if (controllerConstructor && (controllerConstructor as any).__allowedRooms) {
    console.log(
      'Controller-level restrictions:',
      (controllerConstructor as any).__allowedRooms
    );
  }

  console.log('=== End Debug ===');
}
