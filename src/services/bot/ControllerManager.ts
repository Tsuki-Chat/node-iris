import { BaseController } from '@/controllers/BaseController';
import {
  getBatchControllers,
  getBootstrapControllers,
  getBootstrapMethods,
  getRegisteredControllers,
  getScheduleMessageMethods,
  getScheduleMethods,
} from '@/decorators';
import { BatchScheduler } from '@/services/core/BatchScheduler';
import { ChatContext } from '@/types/models/classes';
import { Logger } from '@/utils/logger';
import { EventManager } from './EventManager';

export interface ControllerManagerOptions {
  autoRegisterControllers?: boolean;
}

export class ControllerManager {
  private controllers: BaseController[] = [];
  private registeredMethods: Function[] = [];
  private logger: Logger;
  private batchScheduler: BatchScheduler;
  private eventManager: EventManager;

  constructor(
    logger: Logger,
    batchScheduler: BatchScheduler,
    eventManager: EventManager,
    options: ControllerManagerOptions = {}
  ) {
    this.logger = logger;
    this.batchScheduler = batchScheduler;
    this.eventManager = eventManager;

    // Auto-register controllers only if enabled (default: true for backward compatibility)
    if (options.autoRegisterControllers !== false) {
      this.autoRegisterControllers();
    }
  }

  /**
   * Register a controller with the bot
   */
  addController(controller: BaseController): void {
    this.controllers.push(controller);
    this.eventManager.registerControllerMethods(controller);
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
            this.logger.info(
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
            this.logger.info(
              `Registered bootstrap controller: ${ControllerClass.name}`
            );
            break;
          }
        }

        // If it's neither batch nor bootstrap, register as normal controller
        if (!isBatchController && !isBootstrapController) {
          this.addController(controller);
          this.logger.info(`Registered controller: ${ControllerClass.name}`);
        }
      } catch (error) {
        this.logger.error(
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
        this.logger.info(
          `Registered schedule task: ${scheduleId} (${interval}ms)`
        );
      } else if (cronExpression) {
        this.batchScheduler.registerCronTask(
          scheduleId,
          cronExpression,
          method as (contexts: ChatContext[]) => Promise<void>
        );
        this.logger.info(
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
      this.logger.info(`Registered schedule message handler for key: ${key}`);
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
      this.logger.info(
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
        this.logger.info(
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
        this.logger.info(
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
        this.logger.info(
          `Auto-registered bootstrap controller: ${controllerClass.name}`
        );
      });
    });
  }

  /**
   * Get all registered controllers
   */
  getControllers(): BaseController[] {
    return this.controllers;
  }
}
