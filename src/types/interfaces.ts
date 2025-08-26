/**
 * Interface definitions for Iris API
 */

export interface IIrisAPI {
  query(sql: string, params: any[]): Promise<any[]>;
  sendMessage(roomId: number, message: string): Promise<void>;
  sendMedia(roomId: number, files: Buffer[]): Promise<void>;
  getInfo(): Promise<{ bot_id: number; [key: string]: any }>;
  getRoomInfo(roomId: number): Promise<any>;
  getUserInfo(userId: number): Promise<any>;
}
