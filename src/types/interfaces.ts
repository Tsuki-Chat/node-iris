/**
 * Interface definitions for Iris API
 */

export interface IIrisAPI {
  // Core methods matching Python iris API
  reply(roomId: string | number, message: string): Promise<any>;
  replyMedia(roomId: string | number, files: Buffer[]): Promise<any>;
  decrypt(
    enc: number,
    b64Ciphertext: string,
    userId: string | number
  ): Promise<string | null>;
  query(query: string, bind?: any[]): Promise<any[]>;
  getInfo(): Promise<any>;
  getAot(): Promise<any>;
}
