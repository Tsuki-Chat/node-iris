/**
 * Attachment types and interfaces
 */

export interface MentionAttachment {
  user_id: bigint;
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
  accountId: bigint;
  userid: bigint;
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
  src_linkId: bigint;
  src_logId: bigint;
  src_message: string;
  src_type: number;
  src_userId: bigint;
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
