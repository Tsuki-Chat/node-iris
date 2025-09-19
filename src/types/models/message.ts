/**
 * Message class and related types
 */

import { idToString, toSafeId } from '@/utils';
import { Logger } from '@/utils/logger';
import type { ParsedAttachmentType } from './attachment-types';
import type { SafeId, VField } from './base';
import type { ParsedMessageType } from './feed-types';
import {
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

// 첨부파일 파싱 함수들

// bigint ID를 안전하게 검증하는 헬퍼 함수
function isValidId(value: any): boolean {
  // null 또는 undefined 체크
  if (value === null || value === undefined) {
    return false;
  }

  // BigInt 타입 처리 (lossless-json에서 정수를 BigInt로 파싱함)
  if (typeof value === 'bigint') {
    return true; // 모든 BigInt 값(0n 포함)을 유효한 것으로 간주
  }

  // 문자열 타입 처리
  if (typeof value === 'string') {
    return value !== ''; // 빈 문자열이 아니면 유효
  }

  // 숫자 타입 처리 (0 포함)
  if (typeof value === 'number') {
    return true; // 모든 숫자 값(0, NaN 포함)을 유효한 것으로 간주
  }

  // 기타 truthy 값들
  return !!value;
}

function validateMentionListAttachment(obj: any): boolean {
  if (!obj || !Array.isArray(obj.mentions)) {
    return false;
  }

  // mentions 배열의 각 요소가 유효한 user_id를 가지는지 확인
  return obj.mentions.every(
    (mention: any) => mention && isValidId(mention.user_id)
  );
}

function validatePhotoAttachment(obj: any): boolean {
  return obj && ((obj.url && obj.w && obj.h) || obj.imageUrl);
}

function validateVideoAttachment(obj: any): boolean {
  return obj && obj.url && obj.d;
}

function validateAudioAttachment(obj: any): boolean {
  return obj && obj.url && obj.d && obj.s;
}

function validateReplyAttachment(obj: any): boolean {
  const result =
    obj &&
    isValidId(obj.src_logId) &&
    isValidId(obj.src_linkId) &&
    isValidId(obj.src_userId) &&
    (typeof obj.attach_type === 'number' ||
      typeof obj.src_type === 'number' ||
      !isNaN(Number(obj.attach_type)) ||
      !isNaN(Number(obj.src_type)));

  if (!result) {
    const logger = new Logger('validateReplyAttachment');
    logger.debug('Validation failed:', {
      hasObj: !!obj,
      srcLogId: obj?.src_logId,
      srcLinkId: obj?.src_linkId,
      srcUserId: obj?.src_userId,
      hasSrcLogId: isValidId(obj?.src_logId),
      hasSrcLinkId: isValidId(obj?.src_linkId),
      hasSrcUserId: isValidId(obj?.src_userId),
      attachType: obj?.attach_type,
      srcType: obj?.src_type,
      attachTypeIsNumber: typeof obj?.attach_type === 'number',
      srcTypeIsNumber: typeof obj?.src_type === 'number',
      attachTypeCanParse: !isNaN(Number(obj?.attach_type)),
      srcTypeCanParse: !isNaN(Number(obj?.src_type)),
    });
  }

  return result;
}

function validateFileAttachment(obj: any): boolean {
  return obj && obj.name && obj.url && obj.size;
}

function validateProfileAttachment(obj: any): boolean {
  return (
    obj &&
    isValidId(obj.accountId) &&
    isValidId(obj.userid) &&
    obj.nickName &&
    typeof obj.userType === 'number'
  );
}

function validateNewMultiPhotoAttachment(obj: any): boolean {
  return obj && obj.C;
}

function validateMultiPhotoAttachment(obj: any): boolean {
  return obj && Array.isArray(obj.imageUrls);
}

function safeParseAttachment(
  attachment: any,
  messageType: number
): ParsedAttachmentType {
  // null이거나 빈 문자열인 경우
  if (!attachment || attachment === '') {
    return null;
  }

  const logger = new Logger('Models: safeParseAttachment');

  try {
    // 문자열인 경우 JSON 파싱 시도
    let parsed = attachment;
    if (typeof attachment === 'string') {
      logger.debug(
        `Parsing attachment string for type ${messageType}:`,
        attachment
      );
      try {
        const { safeJsonParseWithReviver } = require('@/utils');
        parsed = safeJsonParseWithReviver(attachment);
        logger.debug(`Successfully parsed attachment:`, parsed);
      } catch (parseError) {
        logger.warn(`JSON parsing failed for type ${messageType}:`, parseError);
        // JSON 파싱 실패 시 원본 문자열 반환
        return attachment;
      }
    }

    // 메시지 타입에 따른 첨부파일 검증 및 타입 캐스팅
    switch (messageType) {
      case 1: // NormalChat - MentionListAttachment | null | ''
        if (!parsed || parsed === '') return null;
        if (validateMentionListAttachment(parsed)) {
          return parsed;
        }
        return null;

      case 2: // PhotoChat
        if (validatePhotoAttachment(parsed)) {
          return parsed;
        }
        break;

      case 3: // VideoChat
        if (validateVideoAttachment(parsed)) {
          return parsed;
        }
        break;

      case 5: // AudioChat
        if (validateAudioAttachment(parsed)) {
          return parsed;
        }
        break;

      case 17: // ProfileChat
        if (validateProfileAttachment(parsed)) {
          return parsed;
        }
        break;

      case 18: // FileChat
        if (validateFileAttachment(parsed)) {
          return parsed;
        }
        break;

      case 26: // ReplyChat
        logger.debug(`Validating reply attachment:`, parsed);
        if (validateReplyAttachment(parsed)) {
          logger.debug(`Reply attachment validation passed`);
          return parsed;
        } else {
          logger.warn(`Reply attachment validation failed. Fields:`, {
            src_logId: parsed?.src_logId,
            src_type: parsed?.src_type,
            attach_type: parsed?.attach_type,
            hasAllFields: !!(
              parsed?.src_logId &&
              (parsed?.src_type !== undefined ||
                parsed?.attach_type !== undefined)
            ),
          });
        }
        break;

      case 27: // MultiPhotoChat (legacy)
        if (validateMultiPhotoAttachment(parsed)) {
          return parsed;
        }
        break;

      case 71: // NewMultiPhotoChat
        if (validateNewMultiPhotoAttachment(parsed)) {
          return parsed;
        }
        break;

      default:
        // 기타 메시지 타입의 경우 기본 검증 없이 반환
        return parsed;
    }

    // 검증 실패 시 원본 반환
    logger.warn(`Attachment validation failed for type ${messageType}`);
    return attachment;
  } catch (error) {
    logger.error('Failed to parse attachment:', error);
    return attachment;
  }
}

export class Message {
  private logger: Logger = new Logger('Message');
  public id: SafeId;
  public type: number;
  public msg: ParsedMessageType;
  public attachment: ParsedAttachmentType;
  public v: VField | null;
  public command: string;
  public param?: string;
  public hasParam: boolean;
  public image?: ChatImage;

  constructor(
    id: number | string | bigint,
    type: number,
    msg: string,
    attachment: any,
    v: VField
  ) {
    this.id = toSafeId(id);
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

  getIdAsString(): string {
    return idToString(this.id);
  }

  getIdAsBigInt(): bigint {
    return this.id;
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
