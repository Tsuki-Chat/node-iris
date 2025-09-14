/**
 * Main export file for node-iris models
 * This file maintains backward compatibility by re-exporting all types and classes
 */

// Base types
export * from './base';

// Feed types
export * from './feed-types';

// Attachment types
export * from './attachment-types';

// Utility functions
export * from './utils';

// Message class and ChatImage
export * from './message';

// Core classes
export * from './classes';

// Legacy compatibility - ensure all original exports are available

export {
  getFeedLogMessage,
  hasPathProperty,
  isAudioAttachment,
  isDeleteMessageFeed,
  isFeedMessage,
  isFileAttachment,
  isInviteUserFeed,
  isLeaveUserFeed,
  isMentionListAttachment,
  isMultiPhotoAttachment,
  isNewMultiPhotoAttachment,
  isOpenChatDemoteManagerFeed,
  isOpenChatHandOverHostFeed,
  isOpenChatHideMessageFeed,
  isOpenChatJoinUserFeed,
  isOpenChatKickedUserFeed,
  isOpenChatPromoteManagerFeed,
  isPhotoAttachment,
  isReplyAttachment,
  isStringMessage,
  isVideoAttachment,
  safeParseMessage,
} from './utils';

export { ChatImage, Message } from './message';

export { Avatar, ChatContext, ErrorContext, Room, User } from './classes';
