/**
 * Batch processing and scheduling decorators
 */

import { BatchScheduler } from '@/services/core/BatchScheduler';
import { ChatContext } from '@/types/models';
import {
  batchControllerRegistry,
  bootstrapControllerRegistry,
  decoratorMetadata,
  registerController,
} from './base';

/**
 * Class decorator for BatchController
 */
export function BatchController<T extends { new (...args: any[]): {} }>(
  constructor: T
) {
  // Register in main controller registry for processing
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
  // Register in main controller registry for processing
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
 * Helper function to get schedule methods from a controller
 */
export function getScheduleMethods(controller: any): Array<{
  method: Function;
  scheduleId: string;
  interval?: number;
  cronExpression?: string;
}> {
  const scheduleMethods: Array<{
    method: Function;
    scheduleId: string;
    interval?: number;
    cronExpression?: string;
  }> = [];

  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(controller));
  methods.forEach((methodName) => {
    if (methodName !== 'constructor') {
      const method = controller[methodName];
      if (typeof method === 'function') {
        const metadata = decoratorMetadata.get(method);
        if (metadata && (metadata as any).scheduleId) {
          scheduleMethods.push({
            method: method.bind(controller),
            scheduleId: (metadata as any).scheduleId,
            interval: (metadata as any).scheduleInterval,
            cronExpression: (metadata as any).scheduleCron,
          });
        }
      }
    }
  });

  return scheduleMethods;
}

/**
 * Helper function to get schedule message methods from a controller
 */
export function getScheduleMessageMethods(controller: any): Array<{
  method: Function;
  key: string;
}> {
  const scheduleMessageMethods: Array<{
    method: Function;
    key: string;
  }> = [];

  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(controller));
  methods.forEach((methodName) => {
    if (methodName !== 'constructor') {
      const method = controller[methodName];
      if (typeof method === 'function') {
        const metadata = decoratorMetadata.get(method);
        if (metadata && (metadata as any).scheduleMessageKey) {
          scheduleMessageMethods.push({
            method: method.bind(controller),
            key: (metadata as any).scheduleMessageKey,
          });
        }
      }
    }
  });

  return scheduleMessageMethods;
}

/**
 * Helper function to get bootstrap methods from a controller
 */
export function getBootstrapMethods(controller: any): Array<{
  method: Function;
  priority: number;
}> {
  const bootstrapMethods: Array<{
    method: Function;
    priority: number;
  }> = [];

  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(controller));
  methods.forEach((methodName) => {
    if (methodName !== 'constructor') {
      const method = controller[methodName];
      if (typeof method === 'function') {
        const metadata = decoratorMetadata.get(method);
        if (
          metadata &&
          typeof (metadata as any).bootstrapPriority === 'number'
        ) {
          bootstrapMethods.push({
            method: method.bind(controller),
            priority: (metadata as any).bootstrapPriority,
          });
        }
      }
    }
  });

  return bootstrapMethods;
}

/**
 * Add a ChatContext to a scheduled task
 */
export function addContextToSchedule(
  scheduleId: string,
  context: ChatContext
): void {
  // This would typically interact with the BatchScheduler
  // Implementation depends on your specific scheduling needs
  console.log(`Adding context to schedule ${scheduleId}:`, {
    roomId: context.room.getIdAsString(),
    userId: context.sender.getIdAsString(),
    message: context.message.msg,
  });
}

/**
 * Schedule a message to be sent at a specific time
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
