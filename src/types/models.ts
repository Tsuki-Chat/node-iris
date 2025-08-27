/**
 * TypeScript port of iris.bot.models
 */

import { IIrisAPI } from './interfaces';
import { Logger } from '../utils/logger';

export interface IrisRawData {
  [key: string]: any;
}

export interface IrisRequest {
  raw: IrisRawData;
  room: string;
  sender: string;
}

export interface VField {
  notDecoded?: boolean;
  origin?: string;
  c?: string;
  isSingleDefaultEmoticon?: boolean;
  defaultEmoticonsCount?: number;
  isMine?: boolean;
  enc?: number;
  modifyRevision?: number;
  [key: string]: any;
}

export interface FeedUser {
  userId: string | number;
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
  hidden: boolean;
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

// 피드 타입 매핑 테이블
const FEED_TYPE_MAP = {
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

function safeParseMessage(message: string): ParsedMessageType {
  // 빈 문자열이나 null 체크
  if (!message || typeof message !== 'string') {
    return message || '';
  }

  try {
    const parsed = JSON.parse(message);

    // feedType이 존재하고 숫자인지 확인
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.feedType &&
      typeof parsed.feedType === 'number'
    ) {
      const feedType = parsed.feedType;

      // 매핑 테이블에서 지원하는 feedType인지 확인
      if (feedType in FEED_TYPE_MAP) {
        // 기본적인 구조 검증
        const isValid = validateFeedStructure(parsed, feedType);
        if (isValid) {
          return parsed as ParsedMessageType;
        }
      }

      // 지원하지 않는 feedType이지만 유효한 JSON인 경우 원본 반환
      console.warn(`Unsupported feedType: ${feedType}`);
      return message;
    }

    // feedType이 없는 일반 JSON은 원본 문자열로 반환
    return message;
  } catch (error) {
    // JSON 파싱 실패 시 원본 문자열 반환
    return message;
  }
}

// 피드 구조 검증 함수
function validateFeedStructure(parsed: any, feedType: number): boolean {
  try {
    // userId는 숫자나 문자열 모두 허용
    const isValidUser = (user: any) =>
      user &&
      (typeof user.userId === 'string' || typeof user.userId === 'number') &&
      typeof user.nickName === 'string';

    switch (feedType) {
      case 1: // InviteUserFeedType
        return (
          isValidUser(parsed.inviter) &&
          Array.isArray(parsed.members) &&
          parsed.members.every(isValidUser)
        );

      case 2: // LeaveUserFeedType
        return isValidUser(parsed.member) && typeof parsed.hidden === 'boolean';

      case 4: // OpenChatJoinUserFeedType
        return (
          Array.isArray(parsed.members) && parsed.members.every(isValidUser)
        );

      case 6: // OpenChatKickedUserType
        return isValidUser(parsed.member);

      case 11: // OpenChatPromoteManagerType
      case 12: // OpenChatDemoteManagerType
        return isValidUser(parsed.member);

      case 14: // DeleteMessageType
        return parsed.logId && typeof parsed.hidden === 'boolean';

      case 15: // OpenChatHandOverHostType
        return isValidUser(parsed.newHost) && isValidUser(parsed.prevHost);

      case 26: // OpenChatHideMessageType
        return (
          parsed.logId &&
          typeof parsed.hidden === 'boolean' &&
          parsed.coverType &&
          Array.isArray(parsed.chatLogInfos)
        );

      default:
        return false;
    }
  } catch (error) {
    return false;
  }
}

// 타입 체크 유틸리티 함수들
export function isStringMessage(msg: ParsedMessageType): msg is string {
  return typeof msg === 'string';
}

export function isFeedMessage(
  msg: ParsedMessageType
): msg is Exclude<ParsedMessageType, string> {
  return typeof msg === 'object' && msg !== null && 'feedType' in msg;
}

export function isInviteUserFeed(
  msg: ParsedMessageType
): msg is InviteUserFeedType {
  return isFeedMessage(msg) && msg.feedType === 1;
}

export function isLeaveUserFeed(
  msg: ParsedMessageType
): msg is LeaveUserFeedType {
  return isFeedMessage(msg) && msg.feedType === 2;
}

export function isOpenChatJoinUserFeed(
  msg: ParsedMessageType
): msg is OpenChatJoinUserFeedType {
  return isFeedMessage(msg) && msg.feedType === 4;
}

export function isOpenChatKickedUserFeed(
  msg: ParsedMessageType
): msg is OpenChatKickedUserType {
  return isFeedMessage(msg) && msg.feedType === 6;
}

export function isOpenChatPromoteManagerFeed(
  msg: ParsedMessageType
): msg is OpenChatPromoteManagerType {
  return isFeedMessage(msg) && msg.feedType === 11;
}

export function isOpenChatDemoteManagerFeed(
  msg: ParsedMessageType
): msg is OpenChatDemoteManagerType {
  return isFeedMessage(msg) && msg.feedType === 12;
}

export function isDeleteMessageFeed(
  msg: ParsedMessageType
): msg is DeleteMessageType {
  return isFeedMessage(msg) && msg.feedType === 14;
}

export function isOpenChatHandOverHostFeed(
  msg: ParsedMessageType
): msg is OpenChatHandOverHostType {
  return isFeedMessage(msg) && msg.feedType === 15;
}

export function isOpenChatHideMessageFeed(
  msg: ParsedMessageType
): msg is OpenChatHideMessageType {
  return isFeedMessage(msg) && msg.feedType === 26;
}

// 피드 타입별 로그 메시지 생성 함수
export function getFeedLogMessage(msg: ParsedMessageType): string {
  if (isStringMessage(msg)) {
    return msg;
  }

  // 타입 가드를 통해 feedType이 있는 객체임을 확인
  if (!isFeedMessage(msg)) {
    return '[Unknown FeedType]';
  }

  try {
    const feedType = msg.feedType;

    switch (feedType) {
      case 1: // 사용자 초대
        if (isInviteUserFeed(msg)) {
          const memberNames = msg.members.map((m) => m.nickName).join(', ');
          return `${msg.inviter.nickName}님이 ${memberNames}님을 초대했습니다. ()`;
        }
        break;

      case 2: // 사용자 나감
        if (isLeaveUserFeed(msg)) {
          return msg.kicked
            ? `${msg.member.nickName}님이 내보내기되었습니다. (KICKED)`
            : `${msg.member.nickName}님이 나가셨습니다. ()`;
        }
        break;

      case 4: // 오픈채팅 입장
        if (isOpenChatJoinUserFeed(msg)) {
          const joinNames = msg.members.map((m) => m.nickName).join(', ');
          return `${joinNames}님이 입장하셨습니다.`;
        }
        break;

      case 6: // 오픈채팅 강퇴
        if (isOpenChatKickedUserFeed(msg)) {
          return `${msg.member.nickName}님이 내보내기되었습니다. (KICKED)`;
        }
        break;

      case 11: // 매니저 임명
        if (isOpenChatPromoteManagerFeed(msg)) {
          return `${msg.member.nickName}님이 부방장(MANAGER)으로 임명되었습니다. (SYNCMEMT)`;
        }
        break;

      case 12: // 매니저 해제
        if (isOpenChatDemoteManagerFeed(msg)) {
          return `${msg.member.nickName}님의 부방장(MANAGER) 권한이 해제되었습니다. (SYNCMEMT)`;
        }
        break;

      case 14: // 메시지 삭제
        if (isDeleteMessageFeed(msg)) {
          return '메시지를 삭제되었습니다. (SYNCDLMSG)';
        }
        break;

      case 15: // 호스트 이전
        if (isOpenChatHandOverHostFeed(msg)) {
          return `방장(HOST)이/가 ${msg.prevHost.nickName}님에서 ${msg.newHost.nickName}님으로 변경되었습니다. ()`;
        }
        break;

      case 26: // 메시지 숨김
        if (isOpenChatHideMessageFeed(msg)) {
          return '관리자가 메시지를 숨겨졌습니다. (SYNCREWR)';
        }
        break;

      default:
        return `[Unknown FeedType: ${feedType}]`;
    }

    return `[Feed Message Processing Error: ${feedType}]`;
  } catch (error) {
    return `[Feed Message Parsing Error: ${JSON.stringify(msg)}]`;
  }
}

export interface MentionAttachment {
  user_id: string;
  at: number[];
  len: string;
}

export interface MentionListAttachment {
  mentions: MentionAttachment[];
}

export interface PhotoAttachment {
  cs: string;
  h: number;
  k: string;
  mt: number;
  s: number;
  thumbnailHeight: number;
  thumbnailUrl: string;
  thumbnailWidth: number;
  url: string;
  w: number;
  cmt: string;
  // 레거시 호환을 위한 추가 속성
  imageUrl?: string;
}

export interface MultiPhotoAttachment {
  csl?: string[];
  hl?: number[];
  imageUrls: string[]; // 필수 속성
  kl?: string[];
  mtl?: string[];
  sl?: number[];
  thumbnailHeights?: number[];
  thumbnailUrls?: number[];
  thumbnailWidths?: number[];
  wl?: number[];
  cmtl?: string[];
}

// 71번 타입용 새로운 멀티포토 첨부파일 (최신 형식)
export interface NewMultiPhotoAttachment {
  C?: {
    THL?: Array<{
      TH?: {
        THU?: string; // Thumbnail URL
      };
    }>;
  };
}

export interface VideoAttachment {
  url: string;
  tk: string;
  cs: string;
  s: number;
  d: number;
  w: number;
  h: number;
  urlh: string;
  tkh: string;
  csh: string;
  sh: number;
  dh: number;
  wh: number;
  hh: number;
}

export interface AudioAttachment {
  url: string;
  d: number;
  s: number;
  k: string;
  expire: number;
}

export interface OldEmoticonAttachment {
  alt: string;
  name: string;
  sound: string;
  thumbnailHeight: number;
  thumbnailWidth: number;
  url: string;
}

export interface EmoticonAttachment {
  alt: string;
  name: string;
  path: string;
  type: string;
}

export interface BigEmoticonAttachment extends EmoticonAttachment {
  sound: string;
  width: number;
  height: number;
  xconVersion: string;
  msg: string;
}

export interface MobileEmoticonAttachment extends EmoticonAttachment {
  s: string;
}

export interface PCEmoticonAttachment extends EmoticonAttachment {
  height: number;
  sound: string;
  width: number;
  msg: string;
}

export interface MapAttachment {
  lat: number;
  lng: number;
  a: string;
  t: string;
  c: boolean;
}

export interface ProfileAttachment {
  accountId: string;
  userid: string;
  nickName: string;
  userType: number;
}

export interface FileAttachment {
  cs: string;
  expire: number;
  k: string;
  name: string;
  s: number;
  size: number;
  url: string;
}

export interface ReplyAttachment<N = 0, T = null> {
  attach_only: N extends 0 ? false : true;
  attach_content?: T;
  attach_type: number;
  src_linkId: number;
  src_logId: string;
  src_message: string;
  src_type: number;
  src_userId: number;
  src_mentions: string[];
}

export interface VFields {
  [key: string]: any;
}

export interface Feedattachment {
  feedType: number;
  [key: string]: any;
}

// 첨부파일 타입별 유니온 타입
export type ParsedAttachmentType =
  | null
  | string
  | MentionListAttachment
  | PhotoAttachment
  | MultiPhotoAttachment
  | NewMultiPhotoAttachment
  | VideoAttachment
  | AudioAttachment
  | OldEmoticonAttachment
  | BigEmoticonAttachment
  | MobileEmoticonAttachment
  | PCEmoticonAttachment
  | MapAttachment
  | ProfileAttachment
  | FileAttachment
  | ReplyAttachment;

// 메시지 타입별 첨부파일 타입 매핑
export type NormalChatAttachment = MentionListAttachment | null | '';
export type PhotoChatAttachment = PhotoAttachment;
export type MultiPhotoChatAttachment = MultiPhotoAttachment;
export type EmoticonChatAttachment =
  | BigEmoticonAttachment
  | MobileEmoticonAttachment
  | PCEmoticonAttachment;
export type OldEmoticonChatAttachment = OldEmoticonAttachment;
export type ReplyChatAttachment = ReplyAttachment;
export type FileChatAttachment = FileAttachment;
export type VideoChatAttachment = VideoAttachment;
export type AudioChatAttachment = AudioAttachment;
export type MapChatAttachment = MapAttachment;
export type ProfileChatAttachment = ProfileAttachment;

// 첨부파일 파싱 함수
function safeParseAttachment(
  attachment: any,
  messageType: number
): ParsedAttachmentType {
  // null이거나 빈 문자열인 경우
  if (!attachment || attachment === '') {
    return null;
  }

  try {
    // 문자열인 경우 JSON 파싱 시도
    let parsed = attachment;
    if (typeof attachment === 'string') {
      try {
        parsed = JSON.parse(attachment);
      } catch {
        // JSON 파싱 실패 시 원본 문자열 반환
        return attachment;
      }
    }

    // 메시지 타입에 따른 첨부파일 검증 및 타입 캐스팅
    switch (messageType) {
      case 1: // NormalChat - MentionListAttachment | null | ''
        if (!parsed || parsed === '') return null;
        if (validateMentionListAttachment(parsed)) {
          return parsed as MentionListAttachment;
        }
        return null;

      case 2: // PhotoChat
        if (validatePhotoAttachment(parsed)) {
          return parsed as PhotoAttachment;
        }
        break;

      case 3: // VideoChat
        if (validateVideoAttachment(parsed)) {
          return parsed as VideoAttachment;
        }
        break;

      case 5: // AudioChat
        if (validateAudioAttachment(parsed)) {
          return parsed as AudioAttachment;
        }
        break;

      case 6: // OldEmoticonChat
        if (validateOldEmoticonAttachment(parsed)) {
          return parsed as OldEmoticonAttachment;
        }
        break;

      case 12: // BigEmoticonChat
        if (validateBigEmoticonAttachment(parsed)) {
          return parsed as BigEmoticonAttachment;
        }
        break;

      case 16: // MapChat
        if (validateMapAttachment(parsed)) {
          return parsed as MapAttachment;
        }
        break;

      case 17: // ProfileChat
        if (validateProfileAttachment(parsed)) {
          return parsed as ProfileAttachment;
        }
        break;

      case 18: // FileChat
        if (validateFileAttachment(parsed)) {
          return parsed as FileAttachment;
        }
        break;

      case 20: // MobileEmoticonChat
        if (validateMobileEmoticonAttachment(parsed)) {
          return parsed as MobileEmoticonAttachment;
        }
        break;

      case 25: // PCEmoticonChat
        if (validatePCEmoticonAttachment(parsed)) {
          return parsed as PCEmoticonAttachment;
        }
        break;

      case 26: // ReplyChat
        if (validateReplyAttachment(parsed)) {
          return parsed as ReplyAttachment;
        }
        break;

      case 27: // MultiPhotoChat
        if (validateMultiPhotoAttachment(parsed)) {
          return parsed as MultiPhotoAttachment;
        }
        break;

      case 71: // NewMultiPhotoChat
        if (validateNewMultiPhotoAttachment(parsed)) {
          return parsed as NewMultiPhotoAttachment;
        }
        break;

      default:
        // 지원하지 않는 메시지 타입의 경우 원본 반환
        return parsed;
    }

    // 검증 실패 시 원본 반환
    return parsed;
  } catch (error) {
    console.warn(
      `Failed to parse attachment for message type ${messageType}:`,
      error
    );
    return attachment;
  }
}

// 첨부파일 타입별 검증 함수들
function validateMentionListAttachment(obj: any): obj is MentionListAttachment {
  return (
    obj &&
    Array.isArray(obj.mentions) &&
    obj.mentions.every(
      (m: any) =>
        typeof m.user_id === 'string' &&
        Array.isArray(m.at) &&
        typeof m.len === 'string'
    )
  );
}

function validatePhotoAttachment(obj: any): obj is PhotoAttachment {
  return (
    obj &&
    // 기본 형식 (url, w, h 필수)
    ((typeof obj.url === 'string' &&
      typeof obj.w === 'number' &&
      typeof obj.h === 'number') ||
      // 레거시 호환 형식 (imageUrl만 있는 경우)
      typeof obj.imageUrl === 'string')
  );
}

function validateMultiPhotoAttachment(obj: any): obj is MultiPhotoAttachment {
  return (
    obj &&
    Array.isArray(obj.imageUrls) &&
    // 기본 검증은 imageUrls만 있으면 충분, 나머지는 선택적
    (obj.wl === undefined || Array.isArray(obj.wl)) &&
    (obj.hl === undefined || Array.isArray(obj.hl))
  );
}

function validateNewMultiPhotoAttachment(
  obj: any
): obj is NewMultiPhotoAttachment {
  return obj && obj.C && Array.isArray(obj.C.THL);
}

function validateVideoAttachment(obj: any): obj is VideoAttachment {
  return (
    obj &&
    typeof obj.url === 'string' &&
    typeof obj.d === 'number' &&
    typeof obj.w === 'number' &&
    typeof obj.h === 'number'
  );
}

function validateAudioAttachment(obj: any): obj is AudioAttachment {
  return (
    obj &&
    typeof obj.url === 'string' &&
    typeof obj.d === 'number' &&
    typeof obj.s === 'number'
  );
}

function validateOldEmoticonAttachment(obj: any): obj is OldEmoticonAttachment {
  return obj && typeof obj.name === 'string' && typeof obj.url === 'string';
}

function validateBigEmoticonAttachment(obj: any): obj is BigEmoticonAttachment {
  return (
    obj &&
    typeof obj.name === 'string' &&
    typeof obj.path === 'string' &&
    typeof obj.width === 'number' &&
    typeof obj.height === 'number'
  );
}

function validateMobileEmoticonAttachment(
  obj: any
): obj is MobileEmoticonAttachment {
  return (
    obj &&
    typeof obj.name === 'string' &&
    typeof obj.path === 'string' &&
    typeof obj.s === 'string'
  );
}

function validatePCEmoticonAttachment(obj: any): obj is PCEmoticonAttachment {
  return (
    obj &&
    typeof obj.name === 'string' &&
    typeof obj.path === 'string' &&
    typeof obj.width === 'number' &&
    typeof obj.height === 'number'
  );
}

function validateMapAttachment(obj: any): obj is MapAttachment {
  return obj && typeof obj.lat === 'number' && typeof obj.lng === 'number';
}

function validateProfileAttachment(obj: any): obj is ProfileAttachment {
  return (
    obj && typeof obj.userid === 'string' && typeof obj.nickName === 'string'
  );
}

function validateFileAttachment(obj: any): obj is FileAttachment {
  return (
    obj &&
    typeof obj.name === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.size === 'number'
  );
}

// 첨부파일 타입 체크 유틸리티 함수들
export function isMentionListAttachment(
  attachment: ParsedAttachmentType
): attachment is MentionListAttachment {
  return (
    attachment !== null &&
    typeof attachment === 'object' &&
    'mentions' in attachment
  );
}

export function isPhotoAttachment(
  attachment: ParsedAttachmentType
): attachment is PhotoAttachment {
  return (
    attachment !== null &&
    typeof attachment === 'object' &&
    // 기본 형식 (url, w, h 필수)
    (('url' in attachment && 'w' in attachment && 'h' in attachment) ||
      // 레거시 호환 형식 (imageUrl만 있는 경우)
      'imageUrl' in attachment)
  );
}

export function isMultiPhotoAttachment(
  attachment: ParsedAttachmentType
): attachment is MultiPhotoAttachment {
  return (
    attachment !== null &&
    typeof attachment === 'object' &&
    'imageUrls' in attachment
  );
}

export function isVideoAttachment(
  attachment: ParsedAttachmentType
): attachment is VideoAttachment {
  return (
    attachment !== null &&
    typeof attachment === 'object' &&
    'url' in attachment &&
    'd' in attachment
  );
}

export function isAudioAttachment(
  attachment: ParsedAttachmentType
): attachment is AudioAttachment {
  return (
    attachment !== null &&
    typeof attachment === 'object' &&
    'url' in attachment &&
    'd' in attachment &&
    's' in attachment
  );
}

export function isReplyAttachment(
  attachment: ParsedAttachmentType
): attachment is ReplyAttachment {
  return (
    attachment !== null &&
    typeof attachment === 'object' &&
    'src_logId' in attachment
  );
}

export function isFileAttachment(
  attachment: ParsedAttachmentType
): attachment is FileAttachment {
  return (
    attachment !== null &&
    typeof attachment === 'object' &&
    'name' in attachment &&
    'url' in attachment &&
    'size' in attachment
  );
}

export function isNewMultiPhotoAttachment(
  attachment: ParsedAttachmentType
): attachment is NewMultiPhotoAttachment {
  return (
    attachment !== null && typeof attachment === 'object' && 'C' in attachment
  );
}

// 첨부파일에 path 속성이 있는지 확인하는 함수
export function hasPathProperty(
  attachment: ParsedAttachmentType
): attachment is { path: string } & ParsedAttachmentType {
  return (
    attachment !== null &&
    typeof attachment === 'object' &&
    'path' in attachment
  );
}

function validateReplyAttachment(obj: any): obj is ReplyAttachment {
  return (
    obj &&
    typeof obj.src_logId === 'string' &&
    typeof obj.src_message === 'string' &&
    typeof obj.attach_type === 'number'
  );
}

export class Message {
  private logger: Logger = new Logger('Message');
  public id: string;
  public type: number;
  public msg: ParsedMessageType;
  public attachment: ParsedAttachmentType;
  public v: VField | null;
  public command: string;
  public param?: string;
  public hasParam: boolean;
  public image?: ChatImage;

  constructor(
    id: number | string,
    type: number,
    msg: string,
    attachment: any,
    v: VField
  ) {
    this.id = String(id); // ID를 항상 문자열로 변환
    this.type = type;
    this.msg = safeParseMessage(msg);
    this.v = v;

    // Parse attachment with type-specific validation
    this.attachment = safeParseAttachment(attachment, type);

    // Parse command and param
    if (isStringMessage(this.msg)) {
      const parts = this.msg.split(' ');
      this.command = parts[0] || '';
      this.hasParam = parts.length > 1;
      this.param = this.hasParam ? parts.slice(1).join(' ') : undefined;
    } else {
      // 피드 메시지의 경우 command는 빈 문자열
      this.command = '';
      this.hasParam = false;
      this.param = undefined;
    }

    // Check if message contains image
    const imageTypes = [71, 27, 2, 71 + 16384, 27 + 16384, 2 + 16384];
    if (imageTypes.includes(this.type)) {
      this.image = new ChatImage(this);
    }

    // Handle long messages with attachment path
    if (
      isStringMessage(this.msg) &&
      this.msg.length >= 3900 &&
      this.attachment &&
      hasPathProperty(this.attachment)
    ) {
      this.loadLongMessage();
    }
  }

  private async loadLongMessage(): Promise<void> {
    try {
      if (!this.attachment || !hasPathProperty(this.attachment)) {
        this.logger.error('Cannot load long message: no path in attachment');
        return;
      }

      const axios = require('axios');
      const response = await axios.get(
        `https://dn-m.talk.kakao.com/${this.attachment.path}`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; node-iris)' },
        }
      );
      response.encoding = 'utf-8';
      this.msg = response.data;
    } catch (error) {
      this.logger.error('Failed to load long message:', error);
    }
  }

  toString(): string {
    if (isStringMessage(this.msg)) {
      return `Message(id=${this.id}, type=${this.type}, msg="${this.msg}")`;
    } else if (isFeedMessage(this.msg)) {
      return `Message(id=${this.id}, type=${this.type}, feedType=${this.msg.feedType}, msg=${getFeedLogMessage(this.msg)})`;
    } else {
      return `Message(id=${this.id}, type=${this.type}, msg=unknown)`;
    }
  }

  // 메시지 타입 확인을 위한 헬퍼 메서드들
  isStringMessage(): boolean {
    return isStringMessage(this.msg);
  }

  isFeedMessage(): boolean {
    return isFeedMessage(this.msg);
  }

  getFeedLogMessage(): string {
    return getFeedLogMessage(this.msg);
  }

  // 메시지 타입별 확인 메서드들
  isNormalMessage(): boolean {
    return this.type === 1; // 일반 텍스트 메시지
  }

  isPhotoMessage(): boolean {
    return this.type === 2; // 사진 메시지
  }

  isVideoMessage(): boolean {
    return this.type === 3; // 동영상 메시지
  }

  isAudioMessage(): boolean {
    return this.type === 5; // 오디오 메시지
  }

  isOldEmoticonMessage(): boolean {
    return this.type === 6; // 구 이모티콘 메시지
  }

  isBigEmoticonMessage(): boolean {
    return this.type === 12; // 큰 이모티콘 메시지
  }

  isMapMessage(): boolean {
    return this.type === 16; // 위치 메시지
  }

  isProfileMessage(): boolean {
    return this.type === 17; // 프로필 메시지
  }

  isFileMessage(): boolean {
    return this.type === 18; // 파일 메시지
  }

  isMobileEmoticonMessage(): boolean {
    return this.type === 20; // 모바일 이모티콘 메시지
  }

  isPCEmoticonMessage(): boolean {
    return this.type === 25; // PC 이모티콘 메시지
  }

  isReplyMessage(): boolean {
    return this.type === 26; // 답장 메시지
  }

  isMultiPhotoMessage(): boolean {
    return this.type === 27; // 다중 사진 메시지 (레거시)
  }

  isNewMultiPhotoMessage(): boolean {
    return this.type === 71; // 다중 사진 메시지 (최신)
  }

  isImageMessage(): boolean {
    return (
      this.isPhotoMessage() ||
      this.isMultiPhotoMessage() ||
      this.isNewMultiPhotoMessage()
    );
  }

  isEmoticonMessage(): boolean {
    return (
      this.isOldEmoticonMessage() ||
      this.isBigEmoticonMessage() ||
      this.isMobileEmoticonMessage() ||
      this.isPCEmoticonMessage()
    );
  }

  // 피드 타입별 확인 메서드들 (피드 메시지인 경우에만)
  isInviteUserFeed(): boolean {
    return this.isFeedMessage() && isInviteUserFeed(this.msg);
  }

  isLeaveUserFeed(): boolean {
    return this.isFeedMessage() && isLeaveUserFeed(this.msg);
  }

  isOpenChatJoinUserFeed(): boolean {
    return this.isFeedMessage() && isOpenChatJoinUserFeed(this.msg);
  }

  isOpenChatKickedUserFeed(): boolean {
    return this.isFeedMessage() && isOpenChatKickedUserFeed(this.msg);
  }

  isOpenChatPromoteManagerFeed(): boolean {
    return this.isFeedMessage() && isOpenChatPromoteManagerFeed(this.msg);
  }

  isOpenChatDemoteManagerFeed(): boolean {
    return this.isFeedMessage() && isOpenChatDemoteManagerFeed(this.msg);
  }

  isDeleteMessageFeed(): boolean {
    return this.isFeedMessage() && isDeleteMessageFeed(this.msg);
  }

  isOpenChatHandOverHostFeed(): boolean {
    return this.isFeedMessage() && isOpenChatHandOverHostFeed(this.msg);
  }

  isOpenChatHideMessageFeed(): boolean {
    return this.isFeedMessage() && isOpenChatHideMessageFeed(this.msg);
  }

  // 첨부파일 타입별 확인 메서드들
  hasMentionAttachment(): boolean {
    return isMentionListAttachment(this.attachment);
  }

  hasPhotoAttachment(): boolean {
    return isPhotoAttachment(this.attachment);
  }

  hasMultiPhotoAttachment(): boolean {
    return isMultiPhotoAttachment(this.attachment);
  }

  hasNewMultiPhotoAttachment(): boolean {
    return isNewMultiPhotoAttachment(this.attachment);
  }

  hasVideoAttachment(): boolean {
    return isVideoAttachment(this.attachment);
  }

  hasAudioAttachment(): boolean {
    return isAudioAttachment(this.attachment);
  }

  hasReplyAttachment(): boolean {
    return isReplyAttachment(this.attachment);
  }

  hasFileAttachment(): boolean {
    return isFileAttachment(this.attachment);
  }

  /**
   * Extract parameters from a message for a specific command
   * @param fullCommand The full command including prefix (e.g., ">>echo", "!help")
   * @returns The parameter string or undefined if no parameters
   */
  getParameterForCommand(fullCommand: string): string | undefined {
    if (!isStringMessage(this.msg)) {
      return undefined;
    }

    // Check if message starts with the command
    if (this.msg === fullCommand) {
      return undefined; // No parameters
    }

    if (this.msg.startsWith(fullCommand + ' ')) {
      const parameterPart = this.msg.substring(fullCommand.length + 1);
      return parameterPart.trim() || undefined;
    }

    return undefined;
  }

  /**
   * Check if message has parameters for a specific command
   * @param fullCommand The full command including prefix
   * @returns True if the message has parameters for this command
   */
  hasParameterForCommand(fullCommand: string): boolean {
    const param = this.getParameterForCommand(fullCommand);
    return param !== undefined && param.length > 0;
  }
}

export class Room {
  public id: string;
  public name: string;
  private _api: IIrisAPI;
  private _type?: string | null;

  constructor(id: number | string, name: string, api: IIrisAPI) {
    this.id = String(id); // ID를 항상 문자열로 변환
    this.name = name;
    this._api = api;
  }

  async getType(): Promise<string | null> {
    if (this._type !== undefined) {
      return this._type as string | null;
    }

    try {
      const results = await this._api.query(
        'SELECT type FROM chat_rooms WHERE id = ?',
        [this.id]
      );

      if (results && results[0]) {
        this._type = results[0].type;
        return this._type as string | null;
      }

      this._type = null;
      return null;
    } catch (error) {
      this._type = null;
      return null;
    }
  }

  toString(): string {
    return `Room(id=${this.id}, name=${this.name})`;
  }
}

export class Avatar {
  private logger: Logger = new Logger('Avatar');
  private _id: string;
  private _chatId: string;
  private _api: IIrisAPI;
  private _url?: string | null;
  private _img?: Buffer | null;

  constructor(id: number | string, chatId: number | string, api: IIrisAPI) {
    this._id = String(id);
    this._chatId = String(chatId);
    this._api = api;
  }

  async getUrl(): Promise<string | null> {
    if (this._url !== undefined) {
      return this._url as string | null;
    }

    try {
      let results: any[];

      if (BigInt(this._id) < 10000000000n) {
        results = await this._api.query(
          'SELECT T2.o_profile_image_url FROM chat_rooms AS T1 JOIN db2.open_profile AS T2 ON T1.link_id = T2.link_id WHERE T1.id = ?',
          [this._chatId]
        );
        this._url = results[0]?.o_profile_image_url || null;
      } else {
        results = await this._api.query(
          'SELECT original_profile_image_url FROM db2.open_chat_member WHERE user_id = ?',
          [this._id]
        );
        this._url = results[0]?.original_profile_image_url || null;
      }

      return this._url as string | null;
    } catch (error) {
      this._url = null;
      return null;
    }
  }

  async getImg(): Promise<Buffer | null> {
    if (this._img !== undefined) {
      return this._img;
    }

    const url = await this.getUrl();

    if (!url) {
      this._img = null;
      return null;
    }

    try {
      const axios = require('axios');
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; node-iris)' },
      });
      this._img = Buffer.from(response.data);
      return this._img;
    } catch (error) {
      this.logger.error('Failed to load avatar image:', error);
      this._img = null;
      return null;
    }
  }

  toString(): string {
    return `Avatar(url=${this._url})`;
  }
}

export class User {
  public id: string;
  public avatar: Avatar;
  private _chatId: string;
  private _api: IIrisAPI;
  private _name?: string | null;
  private _botId?: string;
  private _type?: string | null;

  constructor(
    id: number | string,
    chatId: number | string,
    api: IIrisAPI,
    name?: string,
    botId?: number | string
  ) {
    this.id = String(id);
    this._chatId = String(chatId);
    this._api = api;
    this._name = name;
    this._botId = botId ? String(botId) : undefined;
    this.avatar = new Avatar(id, chatId, api);
  }

  async getName(): Promise<string | null> {
    if (this._name !== undefined) {
      return this._name as string | null;
    }

    try {
      let results: any[];

      if (this.id === this._botId) {
        results = await this._api.query(
          'SELECT T2.nickname FROM chat_rooms AS T1 JOIN db2.open_profile AS T2 ON T1.link_id = T2.link_id WHERE T1.id = ?',
          [this._chatId]
        );
        this._name = results[0]?.nickname || null;
      } else if (BigInt(this.id) < 10000000000n) {
        results = await this._api.query(
          'SELECT name FROM db2.friends WHERE id = ?',
          [this.id]
        );
        this._name = results[0]?.name || null;
      } else {
        results = await this._api.query(
          'SELECT nickname FROM db2.open_chat_member WHERE user_id = ?',
          [this.id]
        );
        this._name = results[0]?.nickname || null;
      }

      return this._name as string | null;
    } catch (error) {
      this._name = null;
      return null;
    }
  }

  async getType(): Promise<string | null> {
    if (this._type !== undefined) {
      return this._type;
    }

    try {
      let results: any[];

      if (this.id === this._botId) {
        results = await this._api.query(
          'SELECT T2.link_member_type FROM chat_rooms AS T1 INNER JOIN open_profile AS T2 ON T1.link_id = T2.link_id WHERE T1.id = ?',
          [this._chatId]
        );
      } else {
        results = await this._api.query(
          'SELECT link_member_type FROM db2.open_chat_member WHERE user_id = ?',
          [this.id]
        );
      }

      const memberType = parseInt(results[0]?.link_member_type || '0');

      switch (memberType) {
        case 1:
          this._type = 'HOST';
          break;
        case 2:
          this._type = 'NORMAL';
          break;
        case 4:
          this._type = 'MANAGER';
          break;
        case 8:
          this._type = 'BOT';
          break;
        default:
          this._type = 'UNKNOWN';
      }

      return this._type;
    } catch (error) {
      this._type = 'REAL_PROFILE';
      return this._type;
    }
  }

  toString(): string {
    return `User(name=${this._name})`;
  }
}

export class ChatImage {
  private logger: Logger = new Logger('ChatImage');
  public url: string[];
  private _img?: Buffer[] | null;

  constructor(message: Message) {
    this.url = this.getPhotoUrl(message);
  }

  async getImg(): Promise<Buffer[] | null> {
    if (this._img !== undefined) {
      return this._img;
    }

    if (!this.url || this.url.length === 0) {
      this._img = null;
      return null;
    }

    try {
      const axios = require('axios');
      const images: Buffer[] = [];

      for (const url of this.url) {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; node-iris)' },
        });
        images.push(Buffer.from(response.data));
      }

      this._img = images;
      return this._img;
    } catch (error) {
      this.logger.error('Failed to load chat images:', error);
      this._img = null;
      return null;
    }
  }

  private getPhotoUrl(message: Message): string[] {
    try {
      const urls: string[] = [];

      if (message.type === 71) {
        // 최신 멀티포토 메시지 (71번)
        if (isNewMultiPhotoAttachment(message.attachment)) {
          const thl = message.attachment.C?.THL;
          if (Array.isArray(thl)) {
            for (const item of thl) {
              if (item.TH?.THU) {
                urls.push(item.TH.THU);
              }
            }
          }
        }
      } else if (message.type === 27) {
        // 레거시 멀티포토 메시지 (27번)
        if (isMultiPhotoAttachment(message.attachment)) {
          const imageUrls = message.attachment.imageUrls;
          if (Array.isArray(imageUrls)) {
            urls.push(...imageUrls);
          }
        }
      } else if (message.type === 2) {
        // 레거시 단일 포토 메시지 (2번)
        if (isPhotoAttachment(message.attachment)) {
          // imageUrl 속성이 있는 경우 (레거시 형식)
          if ('imageUrl' in message.attachment && message.attachment.imageUrl) {
            urls.push(message.attachment.imageUrl);
          }
          // url 속성이 있는 경우 (기본 형식)
          else if ('url' in message.attachment && message.attachment.url) {
            urls.push(message.attachment.url);
          }
        }
      }

      return urls;
    } catch (error) {
      this.logger.error('Failed to parse image URLs:', error);
      return [];
    }
  }
}

export class ChatContext {
  private logger: Logger = new Logger('ChatContext');
  public room: Room;
  public sender: User;
  public message: Message;
  public raw: IrisRawData;
  public api: IIrisAPI;

  constructor(
    room: Room,
    sender: User,
    message: Message,
    raw: IrisRawData,
    api: IIrisAPI
  ) {
    this.room = room;
    this.sender = sender;
    this.message = message;
    this.raw = raw;
    this.api = api;
  }

  async reply(message: string, roomId?: string | number): Promise<void> {
    const targetRoomId = roomId || this.room.id;
    await this.api.reply(targetRoomId, message);
  }

  async replyMedia(files: Buffer[], roomId?: string | number): Promise<void> {
    const targetRoomId = roomId || this.room.id;
    await this.api.replyMedia(targetRoomId, files);
  }

  /**
   * Reply with images from URLs - automatically downloads and converts to base64
   * @param imageUrls - Array of image URLs to download and send
   * @param roomId - Optional room ID (defaults to current room)
   */
  async replyImageUrls(
    imageUrls: string[],
    roomId?: string | number
  ): Promise<void> {
    const targetRoomId = roomId || this.room.id;
    // Temporary cast until interface is updated
    await (this.api as any).replyImageUrls(targetRoomId, imageUrls);
  }

  /**
   * Reply with a single image from URL
   * @param imageUrl - Image URL to download and send
   * @param roomId - Optional room ID (defaults to current room)
   */
  async replyImageUrl(
    imageUrl: string,
    roomId?: string | number
  ): Promise<void> {
    const targetRoomId = roomId || this.room.id;
    // Temporary cast until interface is updated
    await (this.api as any).replyImageUrl(targetRoomId, imageUrl);
  }

  async getSource(): Promise<ChatContext | null> {
    // Check if this message is a reply
    const replyData = this.raw.attachment?.reply;
    if (!replyData) {
      return null;
    }

    try {
      // Get the source message from the API
      const sourceMessage = await this.api.query(
        'SELECT * FROM messages WHERE id = ? AND chat_id = ?',
        [replyData.src_logId, this.room.id]
      );

      if (!sourceMessage || sourceMessage.length === 0) {
        return null;
      }

      // Create ChatContext for source message
      const source = sourceMessage[0];
      const sourceRoom = new Room(this.room.id, this.room.name, this.api);
      const sourceUser = new User(
        source.user_id, // parseInt 제거
        this.room.id,
        this.api,
        source.sender_name
      );
      const sourceMsg = new Message(
        source.id, // parseInt 제거
        parseInt(source.type),
        source.message,
        source.attachment,
        JSON.parse(source.v || '{}')
      );

      return new ChatContext(
        sourceRoom,
        sourceUser,
        sourceMsg,
        source,
        this.api
      );
    } catch (error) {
      this.logger.error('Failed to get source message:', error);
      return null;
    }
  }

  async getNextChat(n: number = 1): Promise<ChatContext | null> {
    try {
      const nextMessages = await this.api.query(
        'SELECT * FROM messages WHERE chat_id = ? AND id > ? ORDER BY id ASC LIMIT ?',
        [this.room.id, this.message.id, n]
      );

      if (!nextMessages || nextMessages.length === 0) {
        return null;
      }

      const next = nextMessages[n - 1] || nextMessages[nextMessages.length - 1];
      const nextRoom = new Room(this.room.id, this.room.name, this.api);
      const nextUser = new User(
        next.user_id, // parseInt 제거
        this.room.id,
        this.api,
        next.sender_name
      );
      const nextMsg = new Message(
        next.id, // parseInt 제거
        parseInt(next.type),
        next.message,
        next.attachment,
        JSON.parse(next.v || '{}')
      );

      return new ChatContext(nextRoom, nextUser, nextMsg, next, this.api);
    } catch (error) {
      this.logger.error('Failed to get next chat:', error);
      return null;
    }
  }

  async getPreviousChat(n: number = 1): Promise<ChatContext | null> {
    try {
      const prevMessages = await this.api.query(
        'SELECT * FROM messages WHERE chat_id = ? AND id < ? ORDER BY id DESC LIMIT ?',
        [this.room.id, this.message.id, n]
      );

      if (!prevMessages || prevMessages.length === 0) {
        return null;
      }

      const prev = prevMessages[n - 1] || prevMessages[prevMessages.length - 1];
      const prevRoom = new Room(this.room.id, this.room.name, this.api);
      const prevUser = new User(
        prev.user_id, // parseInt 제거
        this.room.id,
        this.api,
        prev.sender_name
      );
      const prevMsg = new Message(
        prev.id, // parseInt 제거
        parseInt(prev.type),
        prev.message,
        prev.attachment,
        JSON.parse(prev.v || '{}')
      );

      return new ChatContext(prevRoom, prevUser, prevMsg, prev, this.api);
    } catch (error) {
      this.logger.error('Failed to get previous chat:', error);
      return null;
    }
  }
}

export class ErrorContext {
  public event: string;
  public func: Function;
  public exception: Error;
  public args: any[];

  constructor(event: string, func: Function, exception: Error, args: any[]) {
    this.event = event;
    this.func = func;
    this.exception = exception;
    this.args = args;
  }

  toString(): string {
    return `ErrorContext(event=${this.event}, error=${this.exception.message})`;
  }
}
