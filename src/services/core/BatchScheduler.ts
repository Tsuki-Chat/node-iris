/**
 * Batch Scheduler for handling scheduled tasks and message batching
 */

import { ChatContext } from '@/types/models';
import { Logger } from '@/utils/logger';
import { EventEmitter } from 'events';
import * as cron from 'node-cron';

interface ScheduledTask {
  id: string;
  interval?: NodeJS.Timeout;
  cronJob?: cron.ScheduledTask;
  chatContexts: ChatContext[];
}

export interface ScheduleTask {
  id: string;
  interval?: number;
  cronExpression?: string;
  cronJob?: cron.ScheduledTask;
  handler: (contexts: ChatContext[]) => Promise<void>;
  lastRun: number;
  contexts: ChatContext[];
  isActive: boolean;
}

export interface ScheduledMessage {
  id: string;
  roomId: string;
  message: string;
  scheduledTime: number;
  isProcessed: boolean;
  metadata?: any;
}

export interface BootstrapHandler {
  handler: () => Promise<void>;
  priority: number;
}

export class BatchScheduler {
  private static instance: BatchScheduler | null = null;

  private scheduleTasks = new Map<string, ScheduleTask>();
  private scheduledMessages = new Map<string, ScheduledMessage>();
  private bootstrapHandlers: BootstrapHandler[] = [];
  private isRunning = false;
  private tickInterval = 1000; // 1초마다 체크
  private timer?: NodeJS.Timeout;
  private logger: Logger;
  private eventEmitter = new EventEmitter();

  private constructor() {
    this.logger = new Logger('BatchScheduler');
  }

  static getInstance(): BatchScheduler {
    if (!BatchScheduler.instance) {
      BatchScheduler.instance = new BatchScheduler();
    }
    return BatchScheduler.instance;
  }

  /**
   * 스케줄 태스크 등록 (인터벌 기반)
   */
  registerScheduleTask(
    id: string,
    interval: number,
    handler: (contexts: ChatContext[]) => Promise<void>
  ): void {
    const task: ScheduleTask = {
      id,
      interval,
      handler,
      lastRun: Date.now(),
      contexts: [],
      isActive: true,
    };

    this.scheduleTasks.set(id, task);
    this.logger.info(
      `Registered schedule task: ${id} (interval: ${interval}ms)`
    );
  }

  /**
   * 스케줄 태스크 등록 (cron 기반)
   */
  registerCronTask(
    id: string,
    cronExpression: string,
    handler: (contexts: ChatContext[]) => Promise<void>
  ): void {
    const task: ScheduleTask = {
      id,
      cronExpression,
      handler,
      lastRun: Date.now(),
      contexts: [],
      isActive: true,
    };

    // cron 작업 생성 (바로 시작하지 않음)
    task.cronJob = cron.schedule(cronExpression, async () => {
      if (!task.isActive) return;

      if (task.contexts.length > 0) {
        try {
          this.logger.debug(
            `Executing cron task: ${id} with ${task.contexts.length} contexts`
          );
          await task.handler([...task.contexts]);
          task.contexts = []; // 처리 후 컨텍스트 초기화
        } catch (error) {
          this.logger.error(`Cron task error for ${id}:`, error);
        }
      }
      task.lastRun = Date.now();
    });

    this.scheduleTasks.set(id, task);
    this.logger.info(
      `Registered cron task: ${id} (expression: ${cronExpression})`
    );
  }

  /**
   * ChatContext를 해당 스케줄 태스크에 추가
   */
  addContextToSchedule(scheduleId: string, context: ChatContext): void {
    const task = this.scheduleTasks.get(scheduleId);
    if (task) {
      task.contexts.push(context);
      this.logger.debug(
        `Added context to schedule ${scheduleId}. Total contexts: ${task.contexts.length}`
      );
    } else {
      this.logger.warn(`Schedule task not found: ${scheduleId}`);
    }
  }

  /**
   * 예약 메시지 등록
   */
  scheduleMessage(
    id: string,
    roomId: string,
    message: string,
    scheduledTime: number,
    metadata?: any
  ): void {
    const scheduledMessage: ScheduledMessage = {
      id,
      roomId,
      message,
      scheduledTime,
      isProcessed: false,
      metadata,
    };

    this.scheduledMessages.set(id, scheduledMessage);
    this.logger.info(
      `Scheduled message: ${id} for room ${roomId} at ${new Date(scheduledTime).toISOString()}`
    );
  }

  /**
   * Bootstrap 핸들러 등록
   */
  registerBootstrapHandler(
    handler: () => Promise<void>,
    priority: number = 0
  ): void {
    this.bootstrapHandlers.push({ handler, priority });
    // 우선순위순으로 정렬 (낮은 숫자가 먼저 실행)
    this.bootstrapHandlers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Bootstrap 핸들러들 실행
   */
  async runBootstrap(): Promise<void> {
    this.logger.info(
      `Running ${this.bootstrapHandlers.length} bootstrap handlers...`
    );

    for (const { handler, priority } of this.bootstrapHandlers) {
      try {
        this.logger.debug(
          `Executing bootstrap handler with priority ${priority}`
        );
        await handler();
      } catch (error) {
        this.logger.error('Bootstrap handler error:', error);
      }
    }

    this.logger.info('Bootstrap completed');
  }

  /**
   * 스케줄러 시작
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.timer = setInterval(() => {
      this.tick();
    }, this.tickInterval);

    // cron 작업들 시작
    for (const [id, task] of this.scheduleTasks) {
      if (task.cronJob && task.isActive) {
        task.cronJob.start();
      }
    }

    this.logger.info('Batch scheduler started');
  }

  /**
   * 스케줄러 중지
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    // cron 작업들 중지
    for (const [id, task] of this.scheduleTasks) {
      if (task.cronJob) {
        task.cronJob.stop();
      }
    }

    this.logger.info('Batch scheduler stopped');
  }

  /**
   * 스케줄러 틱 처리
   */
  private async tick(): Promise<void> {
    const now = Date.now();

    // 스케줄 태스크 처리 (인터벌 기반만)
    for (const [id, task] of this.scheduleTasks) {
      if (!task.isActive || !task.interval) continue; // cron 태스크는 건너뛰기

      if (now - task.lastRun >= task.interval) {
        try {
          this.logger.debug(
            `Executing schedule task: ${id} with ${task.contexts.length} contexts`
          );
          await task.handler([...task.contexts]);
          task.contexts = []; // 처리 후 컨텍스트 초기화
        } catch (error) {
          this.logger.error(`Schedule task error for ${id}:`, error);
        }
        task.lastRun = now;
      }
    }

    // 예약 메시지 처리
    for (const [id, scheduledMessage] of this.scheduledMessages) {
      if (scheduledMessage.isProcessed) continue;

      if (now >= scheduledMessage.scheduledTime) {
        try {
          this.logger.debug(`Processing scheduled message: ${id}`);
          this.eventEmitter.emit('scheduled-message', scheduledMessage);
          scheduledMessage.isProcessed = true;
        } catch (error) {
          this.logger.error(`Scheduled message error for ${id}:`, error);
        }
      }
    }

    // 처리된 메시지 정리 (1시간 후)
    const oneHourAgo = now - 60 * 60 * 1000;
    for (const [id, scheduledMessage] of this.scheduledMessages) {
      if (
        scheduledMessage.isProcessed &&
        scheduledMessage.scheduledTime < oneHourAgo
      ) {
        this.scheduledMessages.delete(id);
      }
    }
  }

  /**
   * 스케줄 태스크 비활성화
   */
  disableScheduleTask(id: string): void {
    const task = this.scheduleTasks.get(id);
    if (task) {
      task.isActive = false;
      if (task.cronJob) {
        task.cronJob.stop();
      }
      this.logger.info(`Disabled schedule task: ${id}`);
    }
  }

  /**
   * 스케줄 태스크 활성화
   */
  enableScheduleTask(id: string): void {
    const task = this.scheduleTasks.get(id);
    if (task) {
      task.isActive = true;
      if (task.cronJob && this.isRunning) {
        task.cronJob.start();
      }
      this.logger.info(`Enabled schedule task: ${id}`);
    }
  }

  /**
   * 예약 메시지 이벤트 리스너 등록
   */
  onScheduledMessage(listener: (message: ScheduledMessage) => void): void {
    this.eventEmitter.on('scheduled-message', listener);
  }

  /**
   * 스케줄 태스크 상태 조회
   */
  getScheduleTaskStatus(id: string): ScheduleTask | undefined {
    return this.scheduleTasks.get(id);
  }

  /**
   * 모든 스케줄 태스크 상태 조회
   */
  getAllScheduleTaskStatus(): Map<string, ScheduleTask> {
    return new Map(this.scheduleTasks);
  }

  /**
   * 예약 메시지 상태 조회
   */
  getScheduledMessageStatus(id: string): ScheduledMessage | undefined {
    return this.scheduledMessages.get(id);
  }

  /**
   * 모든 예약 메시지 상태 조회
   */
  getAllScheduledMessageStatus(): Map<string, ScheduledMessage> {
    return new Map(this.scheduledMessages);
  }

  /**
   * 예약 메시지 취소
   */
  cancelScheduledMessage(id: string): boolean {
    return this.scheduledMessages.delete(id);
  }

  /**
   * 스케줄 태스크 제거
   */
  removeScheduleTask(id: string): boolean {
    const removed = this.scheduleTasks.delete(id);
    if (removed) {
      this.logger.info(`Removed schedule task: ${id}`);
    }
    return removed;
  }
}
