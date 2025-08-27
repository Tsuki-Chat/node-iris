/**
 * Unknown Controller for handling unknown events
 */

import { BaseController } from './BaseController';
import { ChatContext } from '../types/models';
import { Logger } from '../utils/logger';

export class UnknownController extends BaseController {
  private logger: Logger;

  constructor() {
    super();
    this.logger = new Logger('UnknownController');
  }

  // async onUnknown(context: ChatContext) {
  //   this.logger.warn('Unknown event received', {
  //     type: context.raw?.type || 'unknown',
  //     room: context.room.name,
  //     sender: await context.sender.getName(),
  //     data: context.raw,
  //   });
  // }
}
