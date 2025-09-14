/**
 * Unified decorator exports for node-iris
 * 
 * This file serves as the main entry point for all decorators,
 * providing a clean and organized API for consumers.
 */

// Re-export base types and utilities
export type { DecoratorHandler } from './core/base';
export {
  setGlobalDebugLogger,
  getGlobalDebugLogger,
  getRegisteredCommands,
  getRegisteredControllers,
  getBatchControllers,
  getBootstrapControllers,
  clearUserThrottle,
  clearAllThrottle,
  getControllerPrefix,
  getMethodPrefix,
  setControllerPrefix,
  setMethodPrefix,
  clearAllPrefixes,
  debugDecoratorMetadata,
  decoratorMetadata,
} from './core/base';

// Re-export controller decorators
export {
  MessageController,
  NewMemberController,
  DeleteMemberController,
  ErrorController,
  FeedController,
  UnknownController,
  ChatController,
} from './core/controller';

// Re-export command decorators
export {
  Command,
  BotCommand,
  HelpCommand,
  getFullCommand,
  isCommandMatch,
  Prefix,
  MethodPrefix,
} from './core/command';

// Re-export message type decorators
export {
  OnMessage,
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
  OnInviteUserFeed,
  OnLeaveUserFeed,
  OnOpenChatJoinUserFeed,
  OnOpenChatKickedUserFeed,
  OnPromoteManagerFeed,
  OnDemoteManagerFeed,
  OnDeleteMessageFeed,
  OnHandOverHostFeed,
  OnHideMessageFeed,
  getMessageHandlers,
  getDecoratedMethods,
} from './core/message';

// Re-export validation decorators
export {
  HasParam,
  IsReply,
  HasRole,
  IsAdmin,
  IsNotBanned,
  Throttle,
  AllowedRoom,
  decorators,
  hasParam,
  isReply,
  isAdmin,
  isNotBanned,
  debugRoomRestrictions,
} from './core/validation';

// Re-export batch and scheduling decorators
export {
  BatchController,
  BootstrapController,
  Schedule,
  ScheduleMessage,
  Bootstrap,
  getScheduleMethods,
  getScheduleMessageMethods,
  getBootstrapMethods,
  addContextToSchedule,
  scheduleMessage,
} from './core/batch';
