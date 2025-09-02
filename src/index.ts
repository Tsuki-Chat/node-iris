/**
 * node-iris - TypeScript port of Python irispy-client module
 */

// Main classes
export { Bot } from './services/Bot';
export { IrisAPI } from './services/IrisAPI';
export { BatchScheduler } from './services/BatchScheduler';
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

// Controllers
export { BaseController } from './controllers/BaseController';

// Decorators
export {
  // Method decorators
  HasParam,
  IsReply,
  IsAdmin,
  IsNotBanned,
  HasRole,
  Command,
  BotCommand,
  HelpCommand,
  Prefix,
  MethodPrefix,
  Throttle,
  // Message type decorators
  OnMessage,
  OnNormalMessage,
  OnFeedMessage,
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
  ChatController as Controller,
  ChatController,
  MessageController,
  NewMemberController,
  DeleteMemberController,
  FeedController,
  ErrorController,
  UnknownController,
  // Batch and Bootstrap decorators
  BatchController,
  BootstrapController,
  Schedule,
  ScheduleMessage,
  Bootstrap,
  // Function decorators (backward compatibility)
  hasParam,
  isReply,
  isAdmin,
  isNotBanned,
  decorators,
  // Utility functions
  getRegisteredCommands,
  getRegisteredControllers,
  getBatchControllers,
  getBootstrapControllers,
  getScheduleMethods,
  getScheduleMessageMethods,
  getBootstrapMethods,
  addContextToSchedule,
  scheduleMessage,
  clearUserThrottle,
  clearAllThrottle,
} from './decorators';

// Utils
export { EventEmitter } from './utils/eventEmitter';
export { Config } from './utils/config';

// Types
export type { EventHandler, ErrorHandler, BotOptions } from './services/Bot';

// Version
export const version = '1.6.18';
export const irispy_client_version = '0.1.6';

// Default export is the Bot class for convenience
import { Bot } from './services/Bot';
export default Bot;
