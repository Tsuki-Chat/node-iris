/**
 * Feed Controller for handling feed events (SYNCDLMSG, JOINLINK, KICKED, SYNCMEMT, SYNCREWR)
 * Override methods in your bot implementation
 */

import { Logger } from '@/utils/logger';
import { BaseController } from './BaseController';

export class FeedController extends BaseController {
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger('FeedController');
  }
}
