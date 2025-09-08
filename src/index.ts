/**
 * node-iris - TypeScript port of Python irispy-client module
 */

// Main classes
export { BatchScheduler } from './services/BatchScheduler';
export { Bot } from './services/Bot';
export { IrisAPI } from './services/IrisAPI';
export {
  KakaoLink,
  KakaoLink2FAException,
  KakaoLinkException,
  KakaoLinkLoginException,
  KakaoLinkReceiverNotFoundException,
  KakaoLinkSendException,
} from './services/IrisLink';
export { defaultLogger, Logger, LogLevel } from './utils/logger';

// Alias for compatibility with Python irispy-client module
export {
  KakaoLink as IrisLink,
  KakaoLink2FAException as IrisLink2FAException,
  KakaoLinkException as IrisLinkException,
  KakaoLinkLoginException as IrisLinkLoginException,
  KakaoLinkReceiverNotFoundException as IrisLinkReceiverNotFoundException,
  KakaoLinkSendException as IrisLinkSendException,
} from './services/IrisLink';

// Models
export {
  Avatar,
  ChatContext,
  ChatImage,
  ErrorContext,
  IrisRawData,
  IrisRequest,
  Message,
  Room,
  User,
} from './types/models';

// Controllers
export { BaseController } from './controllers/BaseController';

// Decorators
export {
  addContextToSchedule,
  AllowedRoom,
  // Batch and Bootstrap decorators
  BatchController,
  Bootstrap,
  BootstrapController,
  BotCommand,
  ChatController,
  clearAllThrottle,
  clearUserThrottle,
  Command,
  // Controller class decorators
  ChatController as Controller,
  debugDecoratorMetadata,
  debugRoomRestrictions,
  decorators,
  DeleteMemberController,
  ErrorController,
  FeedController,
  getBatchControllers,
  getBootstrapControllers,
  getBootstrapMethods,
  // Utility functions
  getRegisteredCommands,
  getRegisteredControllers,
  getScheduleMessageMethods,
  getScheduleMethods,
  // Method decorators
  HasParam,
  // Function decorators (backward compatibility)
  hasParam,
  HasRole,
  HelpCommand,
  IsAdmin,
  isAdmin,
  IsNotBanned,
  isNotBanned,
  IsReply,
  isReply,
  MessageController,
  MethodPrefix,
  NewMemberController,
  OnAudioMessage,
  OnDeleteMessageFeed,
  OnDemoteManagerFeed,
  OnEmoticonMessage,
  OnFeedMessage,
  OnFileMessage,
  OnHandOverHostFeed,
  OnHideMessageFeed,
  OnImageMessage,
  // Feed type decorators
  OnInviteUserFeed,
  OnLeaveUserFeed,
  OnMapMessage,
  // Message type decorators
  OnMessage,
  OnMultiPhotoMessage,
  OnNewMultiPhotoMessage,
  OnNormalMessage,
  OnOpenChatJoinUserFeed,
  OnOpenChatKickedUserFeed,
  OnPhotoMessage,
  OnProfileMessage,
  OnPromoteManagerFeed,
  OnReplyMessage,
  OnVideoMessage,
  Prefix,
  Schedule,
  ScheduleMessage,
  scheduleMessage,
  Throttle,
  UnknownController,
} from './decorators';

// Utils
export { Config } from './utils/config';
export { EventEmitter } from './utils/eventEmitter';

// Types
export type { BotOptions, ErrorHandler, EventHandler } from './services/Bot';

// Version
export const version = '1.6.27';
export const irispy_client_version = '0.1.6';

// Default export is the Bot class for convenience
import { Bot } from './services/Bot';
export default Bot;
