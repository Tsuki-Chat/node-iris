/**
 * Delete Member Controller for handling member leave events
 * Override methods in your bot implementation
 */

import { BaseController } from './BaseController';
import { ChatContext } from '../types/models';
import { Logger } from '../utils/logger';

export class DeleteMemberController extends BaseController {
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger('DeleteMemberController');
  }
}
