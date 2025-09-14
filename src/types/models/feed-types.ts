/**
 * Feed message types and interfaces
 */

export interface FeedUser {
  userId: string;
  nickName: string;
}

export interface FeedType {
  feedType: number;
}

export interface InviteUserFeedType extends FeedType {
  feedType: 1;
  inviter: FeedUser;
  members: FeedUser[];
}

export interface LeaveUserFeedType extends FeedType {
  feedType: 2;
  member: FeedUser;
  hidden?: boolean;
  kicked?: boolean;
}

export interface OpenChatJoinUserFeedType extends FeedType {
  feedType: 4;
  members: FeedUser[];
}

export interface OpenChatKickedUserType extends FeedType {
  feedType: 6;
  member: FeedUser;
}

export interface OpenChatPromoteManagerType extends FeedType {
  feedType: 11;
  member: FeedUser;
}

export interface OpenChatDemoteManagerType extends FeedType {
  feedType: 12;
  member: FeedUser;
}

export interface DeleteMessageType extends FeedType {
  feedType: 14;
  logId: string;
  hidden: true;
}

export interface OpenChatHandOverHostType extends FeedType {
  feedType: 15;
  newHost: FeedUser;
  prevHost: FeedUser;
}

export interface OpenChatHideMessageType extends FeedType {
  feedType: 26;
  coverType: string;
  hidden: boolean;
  chatLogInfos: { logId: string; type: number }[];
  logId: string;
}

// Note: Feedattachment interface moved to attachment-types.ts to avoid duplication

// 피드 타입 매핑 테이블
export const FEED_TYPE_MAP = {
  1: 'InviteUserFeedType',
  2: 'LeaveUserFeedType',
  4: 'OpenChatJoinUserFeedType',
  6: 'OpenChatKickedUserType',
  11: 'OpenChatPromoteManagerType',
  12: 'OpenChatDemoteManagerType',
  14: 'DeleteMessageType',
  15: 'OpenChatHandOverHostType',
  26: 'OpenChatHideMessageType',
} as const;

// 유니온 타입 정의
export type ParsedMessageType =
  | string
  | InviteUserFeedType
  | LeaveUserFeedType
  | OpenChatJoinUserFeedType
  | OpenChatKickedUserType
  | OpenChatPromoteManagerType
  | OpenChatDemoteManagerType
  | DeleteMessageType
  | OpenChatHandOverHostType
  | OpenChatHideMessageType;
