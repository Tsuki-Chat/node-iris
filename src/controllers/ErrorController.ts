/**
 * Error Controller for handling bot errors
 * Override methods in your bot implementation
 */

import { Logger } from '@/utils/logger';
import { BaseController } from './BaseController';

export class ErrorController extends BaseController {
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger('ErrorController');
  }

  // async onError(error: any) {
  //   this.logger.error('Bot Error', error, {
  //     message: error?.message || 'Unknown error',
  //     stack: error?.stack,
  //     error: error,
  //   });
  // }
}
