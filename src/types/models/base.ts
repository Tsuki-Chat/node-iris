/**
 * Basic interfaces and types for node-iris
 */

/**
 * ID type that uses bigint for precise numeric operations
 */
export type SafeId = bigint;

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
