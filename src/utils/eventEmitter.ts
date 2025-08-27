/**
 * TypeScript port of iris.bot._internal.emitter
 */

import { EventEmitter as NodeEventEmitter } from 'events';
import { ErrorContext } from '../types/models';
import { Logger } from '../utils/logger';

export type EventHandler = (...args: any[]) => void | Promise<void>;

export class EventEmitter {
  private logger: Logger = new Logger('EventEmitter');
  private emitter: NodeEventEmitter;
  private maxWorkers?: number;

  constructor(maxWorkers?: number) {
    this.emitter = new NodeEventEmitter();
    this.maxWorkers = maxWorkers;

    // Increase max listeners to avoid warnings
    this.emitter.setMaxListeners(100);
  }

  on(event: string, handler: EventHandler): void {
    this.emitter.on(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    this.emitter.off(event, handler);
  }

  emit(event: string, args: any[] = []): void {
    // Get all listeners for this event
    const listeners = this.emitter.listeners(event);

    if (listeners.length === 0) {
      return;
    }

    // Execute all handlers
    for (const listener of listeners) {
      this.executeHandler(event, listener as EventHandler, args);
    }
  }

  private async executeHandler(
    event: string,
    handler: EventHandler,
    args: any[]
  ): Promise<void> {
    try {
      const result = handler(...args);

      // If handler returns a promise, wait for it
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      // Emit error event
      const errorContext = new ErrorContext(
        event,
        handler,
        error as Error,
        args
      );

      // Don't emit error event if we're already handling an error to avoid infinite loops
      if (event !== 'error') {
        this.emitter.emit('error', errorContext);
      } else {
        this.logger.error('Error in error handler:', error);
      }
    }
  }

  removeAllListeners(event?: string): void {
    this.emitter.removeAllListeners(event);
  }

  listenerCount(event: string): number {
    return this.emitter.listenerCount(event);
  }
}
