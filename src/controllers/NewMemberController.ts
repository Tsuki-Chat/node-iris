/**
 * New Member Controller for handling new member events
 * Override methods in your bot implementation
 */

import { BaseController } from './BaseController';
import { ChatContext } from '../types/models';
import { Logger } from '../utils/logger';

export class NewMemberController extends BaseController {
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger('NewMemberController');
  }
}
