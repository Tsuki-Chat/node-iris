/**
 * Tests for IrisAPI class
 */

import { IrisAPI } from '../services/IrisAPI';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('IrisAPI', () => {
  let api: IrisAPI;
  const mockBaseUrl = 'http://127.0.0.1:3000';

  beforeEach(() => {
    // Reset mocks first
    jest.clearAllMocks();

    // Mock axios.create to return the mocked axios instance
    const mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      defaults: {},
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    // Replace the instance methods with our mocks
    Object.assign(mockedAxios, mockAxiosInstance);

    api = new IrisAPI(mockBaseUrl);
  });

  describe('initialization', () => {
    test('should create IrisAPI instance with correct base URL', () => {
      expect(api).toBeDefined();
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: mockBaseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('getInfo', () => {
    test('should fetch bot information successfully', async () => {
      const mockResponse = {
        data: {
          bot_id: 123,
          name: 'TestBot',
          version: '1.0.0',
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await api.getInfo();

      expect(mockedAxios.get).toHaveBeenCalledWith('/config');
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle API errors', async () => {
      const mockError = new Error('Network error');
      mockedAxios.get.mockRejectedValue(mockError);

      await expect(api.getInfo()).rejects.toThrow('Network error');
    });
  });

  describe('query', () => {
    test('should execute SQL query successfully', async () => {
      const mockResponse = {
        data: {
          data: [
            { id: 1, name: 'test1' },
            { id: 2, name: 'test2' },
          ],
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const sql = 'SELECT * FROM test WHERE id = ?';
      const params = [1];

      const result = await api.query(sql, params);

      expect(mockedAxios.post).toHaveBeenCalledWith('/query', {
        query: sql,
        bind: params,
      });
      expect(result).toEqual([
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' },
      ]);
    });

    test('should handle query without parameters', async () => {
      const mockResponse = {
        data: {
          data: [{ count: 5 }],
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const sql = 'SELECT COUNT(*) as count FROM test';

      const result = await api.query(sql);

      expect(mockedAxios.post).toHaveBeenCalledWith('/query', {
        query: sql,
        bind: [],
      });
      expect(result).toEqual([{ count: 5 }]);
    });

    test('should handle query errors', async () => {
      const mockError = new Error('Query failed');
      mockedAxios.post.mockRejectedValue(mockError);

      const sql = 'INVALID SQL';

      await expect(api.query(sql)).rejects.toThrow('Query failed');
    });
  });

  describe('reply', () => {
    test('should send reply successfully', async () => {
      const mockResponse = {
        data: { success: true },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const roomId = 123;
      const message = '답장 테스트';

      const result = await api.reply(roomId, message);

      expect(mockedAxios.post).toHaveBeenCalledWith('/reply', {
        type: 'text',
        room: String(roomId),
        data: String(message),
      });
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle reply errors', async () => {
      const mockError = new Error('Reply failed');
      mockedAxios.post.mockRejectedValue(mockError);

      await expect(api.reply(123, 'test')).rejects.toThrow('Reply failed');
    });
  });

  // describe('replyMedia', () => {
  //   test('should send media reply successfully', async () => {
  //     const mockResponse = {
  //       data: { success: true },
  //     };

  //     mockedAxios.post.mockResolvedValue(mockResponse);

  //     const roomId = 123;
  //     const files = [Buffer.from('test image')];

  //     const result = await api.replyMedia(roomId, files);

  //     expect(mockedAxios.post).toHaveBeenCalledWith('/reply', {
  //       type: 'image_multiple',
  //       room: String(roomId),
  //       data: files.map((f) => f.toString('base64')),
  //     });
  //     expect(result).toEqual(mockResponse.data);
  //   });

  //   test('should handle empty files array', async () => {
  //     const result = await api.replyMedia(123, []);
  //     expect(result).toBeUndefined();
  //   });
  // });

  describe('decrypt', () => {
    test('should decrypt message successfully', async () => {
      const mockResponse = {
        data: { plain_text: 'decrypted message' },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await api.decrypt(1, 'encrypted_data', 12345);

      expect(mockedAxios.post).toHaveBeenCalledWith('/decrypt', {
        enc: 1,
        b64_ciphertext: 'encrypted_data',
        user_id: '12345',
      });
      expect(result).toBe('decrypted message');
    });

    test('should return null when plain_text is missing', async () => {
      const mockResponse = {
        data: {},
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await api.decrypt(1, 'encrypted_data', 12345);
      expect(result).toBeNull();
    });
  });

  describe('getAot', () => {
    test('should get AOT data successfully', async () => {
      const mockResponse = {
        data: { aot_data: 'test' },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await api.getAot();

      expect(mockedAxios.get).toHaveBeenCalledWith('/aot');
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle AOT errors', async () => {
      const mockError = new Error('AOT failed');
      mockedAxios.get.mockRejectedValue(mockError);

      await expect(api.getAot()).rejects.toThrow('AOT failed');
    });
  });

  describe('error handling', () => {
    test('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      mockedAxios.get.mockRejectedValue(networkError);

      await expect(api.getInfo()).rejects.toThrow('Network Error');
    });

    test('should handle HTTP errors', async () => {
      const httpError = {
        response: {
          status: 404,
          data: { error: 'Not found' },
        },
      };
      mockedAxios.get.mockRejectedValue(httpError);

      await expect(api.getInfo()).rejects.toMatchObject(httpError);
    });
  });
});
