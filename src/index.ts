/**
 * node-iris - TypeScript port of Python irispy-client module
 */

// Main classes
export { Bot } from './services/Bot';
export { IrisAPI } from './services/IrisAPI';
export {
  KakaoLink,
  KakaoLinkException,
  KakaoLinkReceiverNotFoundException,
  KakaoLinkLoginException,
  KakaoLink2FAException,
  KakaoLinkSendException,
} from './services/IrisLink';

// Alias for compatibility with Python irispy-client module
export {
  KakaoLink as IrisLink,
  KakaoLinkException as IrisLinkException,
  KakaoLinkReceiverNotFoundException as IrisLinkReceiverNotFoundException,
  KakaoLinkLoginException as IrisLinkLoginException,
  KakaoLink2FAException as IrisLink2FAException,
  KakaoLinkSendException as IrisLinkSendException,
} from './services/IrisLink';

// Models
export {
  Message,
  Room,
  User,
  Avatar,
  ChatImage,
  ChatContext,
  ErrorContext,
  IrisRequest,
  IrisRawData,
} from './types/models';

// Decorators
export {
  hasParam,
  isReply,
  isAdmin,
  isNotBanned,
  decorators,
} from './decorators';

// Utils
export { EventEmitter } from './utils/eventEmitter';
export { Config } from './utils/config';

// Types
export type { EventHandler, ErrorHandler } from './services/Bot';
export type {
  KakaoLinkTemplate,
  SearchFrom,
  SearchRoomType,
} from './services/IrisLink';

// Version
export const version = '0.1.6';

// Default export is the Bot class for convenience
import { Bot } from './services/Bot';
export default Bot;
