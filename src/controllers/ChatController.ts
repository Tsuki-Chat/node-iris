/**
 * Chat Controller for handling general chat events
 */

import { Logger } from '@/utils/logger';
import { BaseController } from './BaseController';

export class ChatController extends BaseController {
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger('ChatController');
  }
}
