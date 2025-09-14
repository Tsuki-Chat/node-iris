/**
 * Utility functions for type checking and validation
 */

import { safeJsonParseWithReviver } from '@/utils';
import { Logger } from '@/utils/logger';
import type {
  AudioAttachment,
  FileAttachment,
  MentionListAttachment,
  MultiPhotoAttachment,
  NewMultiPhotoAttachment,
  ParsedAttachmentType,
  PhotoAttachment,
  ReplyAttachment,
  VideoAttachment,
} from './attachment-types';
import type {
  DeleteMessageType,
  InviteUserFeedType,
  LeaveUserFeedType,
  OpenChatDemoteManagerType,
  OpenChatHandOverHostType,
  OpenChatHideMessageType,
  OpenChatJoinUserFeedType,
  OpenChatKickedUserType,
  OpenChatPromoteManagerType,
  ParsedMessageType,
} from './feed-types';
import { FEED_TYPE_MAP } from './feed-types';

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

// 메시지 파싱 함수
export function safeParseMessage(message: string): ParsedMessageType {
  // 빈 문자열이나 null 체크
  if (!message || typeof message !== 'string') {
    return message || '';
  }

  const logger = new Logger('Models: safeParseMessage');

  try {
    // JSON reviver 함수를 사용하여 큰 정수를 문자열로 보존
    const parsed = safeJsonParseWithReviver(message);

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
      logger.warn(`Unsupported feedType: ${feedType}`);
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
    // userId는 숫자, 문자열, bigint 모두 허용
    const isValidUser = (user: any) =>
      user &&
      (typeof user.userId === 'string' ||
        typeof user.userId === 'number' ||
        typeof user.userId === 'bigint') &&
      typeof user.nickName === 'string';

    switch (feedType) {
      case 1: // InviteUserFeedType
        return (
          isValidUser(parsed.inviter) &&
          Array.isArray(parsed.members) &&
          parsed.members.every(isValidUser)
        );

      case 2: // LeaveUserFeedType
        return isValidUser(parsed.member);

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
          Array.isArray(parsed.chatLogInfos)
        );

      default:
        return false;
    }
  } catch (error) {
    return false;
  }
}
