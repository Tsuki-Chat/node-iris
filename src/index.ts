/**
 * node-iris - TypeScript port of Python irispy-client module
 */

// Main classes
export { Bot } from './services/Bot';
export { IrisAPI } from './services/IrisAPI';
export { Logger, defaultLogger } from './utils/logger';
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
  // Method decorators
  HasParam,
  IsReply,
  IsAdmin,
  IsNotBanned,
  HasRole,
  BotCommand,
  Prefix,
  MethodPrefix,
  Throttle,
  OnMessage,
  // Message type decorators
  OnNormalMessage,
  OnPhotoMessage,
  OnVideoMessage,
  OnAudioMessage,
  OnEmoticonMessage,
  OnMapMessage,
  OnProfileMessage,
  OnFileMessage,
  OnReplyMessage,
  OnMultiPhotoMessage,
  OnNewMultiPhotoMessage,
  OnImageMessage,
  OnFeedMessage,
  // Feed type decorators
  OnInviteUserFeed,
  OnLeaveUserFeed,
  OnOpenChatJoinUserFeed,
  OnOpenChatKickedUserFeed,
  OnPromoteManagerFeed,
  OnDemoteManagerFeed,
  OnDeleteMessageFeed,
  OnHandOverHostFeed,
  OnHideMessageFeed,
  // Controller class decorators
  MessageController,
  NewMemberController,
  DeleteMemberController,
  FeedController,
  ErrorController,
  UnknownController,
  ChatController,
  // Function decorators (backward compatibility)
  hasParam,
  isReply,
  isAdmin,
  isNotBanned,
  decorators,
  // Utility functions
  getRegisteredCommands,
  getRegisteredControllers,
  clearUserThrottle,
  clearAllThrottle,
} from './decorators';

// Utils
export { EventEmitter } from './utils/eventEmitter';
export { Config } from './utils/config';

// Types
export type { EventHandler, ErrorHandler } from './services/Bot';

// Version
export const version = '1.6.16';
export const irispy_client_version = '0.1.6';

// Default export is the Bot class for convenience
import { Bot } from './services/Bot';
export default Bot;
