/**
 * Delete Member Controller for handling member leave events
 * Override methods in your bot implementation
 */

import { Logger } from '@/utils/logger';
import { BaseController } from './BaseController';

export class DeleteMemberController extends BaseController {
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger('DeleteMemberController');
  }
}
