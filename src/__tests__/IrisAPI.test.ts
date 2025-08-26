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

      expect(mockedAxios.get).toHaveBeenCalledWith('/info');
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle API errors', async () => {
      const mockError = new Error('Network error');
      mockedAxios.get.mockRejectedValue(mockError);

      await expect(api.getInfo()).rejects.toThrow('Network error');
    });
  });

  describe('sendMessage', () => {
    test('should send message successfully', async () => {
      const mockResponse = {
        data: { success: true },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const roomId = 123;
      const message = '안녕하세요!';

      await api.sendMessage(roomId, message);

      expect(mockedAxios.post).toHaveBeenCalledWith('/send', {
        room_id: roomId,
        message: message,
      });
    });

    test('should handle send message errors', async () => {
      const mockError = new Error('Send failed');
      mockedAxios.post.mockRejectedValue(mockError);

      const roomId = 123;
      const message = '테스트 메시지';

      await expect(api.sendMessage(roomId, message)).rejects.toThrow(
        'Send failed'
      );
    });
  });

  describe('sendMedia', () => {
    test('should send media files successfully', async () => {
      const mockResponse = {
        data: { success: true },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const roomId = 123;
      const files = [
        Buffer.from('fake image data'),
        Buffer.from('fake video data'),
      ];

      await api.sendMedia(roomId, files);

      expect(mockedAxios.post).toHaveBeenCalledWith('/send-media', {
        room_id: roomId,
        files: files.map((f) => f.toString('base64')),
      });
    });

    test('should handle send media errors', async () => {
      const mockError = new Error('Media send failed');
      mockedAxios.post.mockRejectedValue(mockError);

      const roomId = 123;
      const files = [Buffer.from('fake data')];

      await expect(api.sendMedia(roomId, files)).rejects.toThrow(
        'Media send failed'
      );
    });
  });

  describe('query', () => {
    test('should execute SQL query successfully', async () => {
      const mockResponse = {
        data: [
          { id: 1, name: 'test1' },
          { id: 2, name: 'test2' },
        ],
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const sql = 'SELECT * FROM test WHERE id = ?';
      const params = [1];

      const result = await api.query(sql, params);

      expect(mockedAxios.post).toHaveBeenCalledWith('/query', {
        sql,
        params,
      });
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle query without parameters', async () => {
      const mockResponse = {
        data: [{ count: 5 }],
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const sql = 'SELECT COUNT(*) as count FROM test';

      const result = await api.query(sql);

      expect(mockedAxios.post).toHaveBeenCalledWith('/query', {
        sql,
        params: [],
      });
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle query errors', async () => {
      const mockError = new Error('Query failed');
      mockedAxios.post.mockRejectedValue(mockError);

      const sql = 'INVALID SQL';

      await expect(api.query(sql)).rejects.toThrow('Query failed');
    });
  });

  describe('getRoomInfo', () => {
    test('should get room information successfully', async () => {
      const mockResponse = {
        data: {
          id: 123,
          name: '테스트 채팅방',
          member_count: 5,
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const roomId = 123;

      const result = await api.getRoomInfo(roomId);

      expect(mockedAxios.get).toHaveBeenCalledWith('/room/123');
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle room info errors', async () => {
      const mockError = new Error('Room not found');
      mockedAxios.get.mockRejectedValue(mockError);

      const roomId = 999;

      await expect(api.getRoomInfo(roomId)).rejects.toThrow('Room not found');
    });
  });

  describe('getUserInfo', () => {
    test('should get user information successfully', async () => {
      const mockResponse = {
        data: {
          id: 456,
          name: '테스트 유저',
          avatar_url: 'http://example.com/avatar.jpg',
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const userId = 456;

      const result = await api.getUserInfo(userId);

      expect(mockedAxios.get).toHaveBeenCalledWith('/user/456');
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle user info errors', async () => {
      const mockError = new Error('User not found');
      mockedAxios.get.mockRejectedValue(mockError);

      const userId = 999;

      await expect(api.getUserInfo(userId)).rejects.toThrow('User not found');
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
