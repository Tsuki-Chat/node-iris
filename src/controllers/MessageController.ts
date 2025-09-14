/**
 * Message Controller for handling chat messages
 */

import { Logger } from '@/utils/logger';
import { BaseController } from './BaseController';

export class MessageController extends BaseController {
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger('MessageController');
  }
}
