/**
 * Feed Controller for handling feed events (SYNCDLMSG, JOINLINK, KICKED, SYNCMEMT, SYNCREWR)
 * Override methods in your bot implementation
 */

import { BaseController } from './BaseController';
import { ChatContext } from '../types/models';
import { Logger } from '../utils/logger';

export class FeedController extends BaseController {
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger('FeedController');
  }
}
