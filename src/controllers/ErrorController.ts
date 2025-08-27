/**
 * Error Controller for handling bot errors
 * Override methods in your bot implementation
 */

import { BaseController } from './BaseController';
import { Logger } from '../utils/logger';

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
