/**
 * TypeScript port of iris.bot._internal.iris
 */

import axios, { AxiosInstance } from 'axios';
import { IIrisAPI } from '../types/interfaces';

export interface IrisRequest {
  raw: Record<string, any>;
  room: string;
  sender: string;
}

export class IrisAPI implements IIrisAPI {
  private httpClient: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    try {
      const response = await this.httpClient.post('/query', {
        sql,
        params,
      });

      return response.data || [];
    } catch (error) {
      console.error('Query failed:', error);
      throw error;
    }
  }

  async sendMessage(roomId: number, message: string): Promise<void> {
    try {
      await this.httpClient.post('/send', {
        room_id: roomId,
        message,
      });
    } catch (error) {
      console.error('Send message failed:', error);
      throw error;
    }
  }

  async sendMedia(roomId: number, files: Buffer[]): Promise<void> {
    try {
      // Convert buffers to base64 for transmission
      const fileData = files.map((buffer) => buffer.toString('base64'));

      await this.httpClient.post('/send-media', {
        room_id: roomId,
        files: fileData,
      });
    } catch (error) {
      console.error('Send media failed:', error);
      throw error;
    }
  }

  async getInfo(): Promise<{ bot_id: number; [key: string]: any }> {
    try {
      const response = await this.httpClient.get('/info');
      return response.data;
    } catch (error) {
      console.error('Get info failed:', error);
      throw error;
    }
  }

  async getRoomInfo(roomId: number): Promise<any> {
    try {
      const response = await this.httpClient.get(`/room/${roomId}`);
      return response.data;
    } catch (error) {
      console.error('Get room info failed:', error);
      throw error;
    }
  }

  async getUserInfo(userId: number): Promise<any> {
    try {
      const response = await this.httpClient.get(`/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Get user info failed:', error);
      throw error;
    }
  }
}
