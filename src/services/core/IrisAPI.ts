/**
 * TypeScript port of iris.bot._internal.iris
 */

import { IIrisAPI } from '@/types';
import { Logger } from '@/utils/logger';
import axios, { AxiosInstance, AxiosResponse } from 'axios';

export interface IrisRequest {
  raw: Record<string, any>;
  room: string;
  sender: string;
}

export class IrisAPI implements IIrisAPI {
  private httpClient: AxiosInstance;
  private irisEndpoint: string;
  private logger: Logger = new Logger('IrisAPI');

  constructor(irisEndpoint: string) {
    this.irisEndpoint = irisEndpoint;
    this.httpClient = axios.create({
      baseURL: irisEndpoint,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private parse(response: AxiosResponse): any {
    try {
      const data = response.data;

      if (response.status < 200 || response.status >= 300) {
        this.logger.error(`Iris error: ${response.status}`);
        throw new Error(`Iris error: ${data?.message || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Iris error')) {
        throw error;
      }
      throw new Error(`Iris response JSON parsing error: ${response.data}`);
    }
  }

  async reply(roomId: string | number, message: string): Promise<any> {
    try {
      const response = await this.httpClient.post('/reply', {
        type: 'text',
        room: String(roomId),
        data: String(message),
      });

      return this.parse(response);
    } catch (error) {
      this.logger.error('Reply failed:', error);
      throw error;
    }
  }

  async replyMedia(roomId: string | number, files: Buffer[]): Promise<any> {
    try {
      // Convert buffers to base64 for transmission
      const data = files.map((buffer) => buffer.toString('base64'));

      if (data.length === 0) {
        this.logger.error(
          'Reply media failed. please check the image sending request part.'
        );
        return;
      }

      const response = await this.httpClient.post('/reply', {
        type: data.length === 1 ? 'image' : 'image_multiple',
        room: String(roomId),
        data: data.length === 1 ? data[0] : data,
      });

      return this.parse(response);
    } catch (error) {
      this.logger.error('Reply media failed:', error);
      throw error;
    }
  }

  /**
   * Reply with images from URLs - automatically downloads and converts to base64
   * @param roomId - Room ID to send message to
   * @param imageUrls - Array of image URLs to download and send
   * @returns Promise<any>
   */
  async replyImageUrls(
    roomId: string | number,
    imageUrls: string[]
  ): Promise<any> {
    try {
      if (imageUrls.length === 0) {
        this.logger.error('No image URLs provided');
        return;
      }

      this.logger.debug(`Downloading ${imageUrls.length} images from URLs`);

      // Download all images
      const downloadPromises = imageUrls.map(async (url) => {
        try {
          // Extract referer from URL
          const urlObj = new URL(url);
          const referer = `${urlObj.protocol}//${urlObj.host}/`;

          const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Accept: 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
              'Accept-Encoding': 'gzip, deflate, br',
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
              'Sec-Fetch-Dest': 'image',
              'Sec-Fetch-Mode': 'no-cors',
              'Sec-Fetch-Site': 'cross-site',
              Referer: referer,
            },
          });

          return Buffer.from(response.data);
        } catch (error) {
          this.logger.error(`Failed to download image from ${url}:`, error);
          throw new Error(`Failed to download image from ${url}: ${error}`);
        }
      });

      const imageBuffers = await Promise.all(downloadPromises);

      // Convert to base64
      const data = imageBuffers.map((buffer) => buffer.toString('base64'));

      const response = await this.httpClient.post('/reply', {
        type: data.length === 1 ? 'image' : 'image_multiple',
        room: String(roomId),
        data: data.length === 1 ? data[0] : data,
      });

      this.logger.debug(
        `Successfully sent ${data.length} images to room ${roomId}`
      );
      return this.parse(response);
    } catch (error) {
      this.logger.error('Reply image URLs failed:', error);
      throw error;
    }
  }

  /**
   * Reply with a single image from URL
   * @param roomId - Room ID to send message to
   * @param imageUrl - Image URL to download and send
   * @returns Promise<any>
   */
  async replyImageUrl(roomId: string | number, imageUrl: string): Promise<any> {
    return this.replyImageUrls(roomId, [imageUrl]);
  }

  async decrypt(
    enc: number,
    b64Ciphertext: string,
    userId: string | number
  ): Promise<string | null> {
    try {
      const response = await this.httpClient.post('/decrypt', {
        enc,
        b64_ciphertext: b64Ciphertext,
        user_id: String(userId), // userId도 문자열로 변환
      });

      const result = this.parse(response);
      return result?.plain_text || null;
    } catch (error) {
      this.logger.error('Decrypt failed:', error);
      throw error;
    }
  }

  async query(query: string, bind: any[] = []): Promise<any[]> {
    try {
      const response = await this.httpClient.post('/query', {
        query,
        bind,
      });

      const result = this.parse(response);
      return result?.data || [];
    } catch (error) {
      this.logger.error('Query failed:', error);
      throw error;
    }
  }

  async getInfo(): Promise<any> {
    try {
      const response = await this.httpClient.get('/config');
      return this.parse(response);
    } catch (error) {
      this.logger.error('Get info failed:', error);
      throw error;
    }
  }

  async getAot(): Promise<any> {
    try {
      const response = await this.httpClient.get('/aot');
      return this.parse(response);
    } catch (error) {
      this.logger.error('Get AOT failed:', error);
      throw error;
    }
  }
}
