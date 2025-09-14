/**
 * New Member Controller for handling new member events
 * Override methods in your bot implementation
 */

import { Logger } from '@/utils/logger';
import { BaseController } from './BaseController';

export class NewMemberController extends BaseController {
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger('NewMemberController');
  }
}
