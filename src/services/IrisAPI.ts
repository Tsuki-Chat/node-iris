/**
 * TypeScript port of iris.bot._internal.iris
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { IIrisAPI } from '../types/interfaces';

export interface IrisRequest {
  raw: Record<string, any>;
  room: string;
  sender: string;
}

export class IrisAPI implements IIrisAPI {
  private httpClient: AxiosInstance;
  private irisEndpoint: string;

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
        console.error(`Iris 오류: ${response.status}`);
        throw new Error(`Iris 오류: ${data?.message || '알 수 없는 오류'}`);
      }

      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Iris 오류')) {
        throw error;
      }
      throw new Error(`Iris 응답 JSON 파싱 오류: ${response.data}`);
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
      console.error('Reply failed:', error);
      throw error;
    }
  }

  async replyMedia(roomId: string | number, files: Buffer[]): Promise<any> {
    try {
      // Convert buffers to base64 for transmission
      const data = files.map((buffer) => buffer.toString('base64'));

      if (data.length === 0) {
        console.error(
          '이미지 전송이 모두 실패하였습니다. 이미지 전송 요청 부분을 확인해주세요.'
        );
        return;
      }

      const response = await this.httpClient.post('/reply', {
        type: 'image_multiple',
        room: String(roomId),
        data: data,
      });

      return this.parse(response);
    } catch (error) {
      console.error('Reply media failed:', error);
      throw error;
    }
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
      console.error('Decrypt failed:', error);
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
      console.error('Query failed:', error);
      throw error;
    }
  }

  async getInfo(): Promise<any> {
    try {
      const response = await this.httpClient.get('/config');
      return this.parse(response);
    } catch (error) {
      console.error('Get info failed:', error);
      throw error;
    }
  }

  async getAot(): Promise<any> {
    try {
      const response = await this.httpClient.get('/aot');
      return this.parse(response);
    } catch (error) {
      console.error('Get AOT failed:', error);
      throw error;
    }
  }
}
