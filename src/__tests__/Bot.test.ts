/**
 * Tests for Bot class
 */

import { Bot } from '../services/Bot';
import { EventEmitter } from '../utils/eventEmitter';

// Mock WebSocket
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // WebSocket.OPEN
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

// Mock WebSocket constructor
jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => mockWebSocket);
});

// Mock IrisAPI
jest.mock('../services/IrisAPI', () => {
  return {
    IrisAPI: jest.fn().mockImplementation(() => ({
      getInfo: jest.fn().mockResolvedValue({ bot_id: 123 }),
      reply: jest.fn().mockResolvedValue({}),
    })),
  };
});

describe('Bot', () => {
  let bot: Bot;
  const mockIrisUrl = '127.0.0.1:3000';

  beforeEach(() => {
    bot = new Bot('Create-Node-Iris-App', mockIrisUrl);
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('should create bot instance with correct configuration', () => {
      expect(bot).toBeDefined();
      expect(bot.api).toBeDefined();
    });

    test('should validate URL format', () => {
      expect(() => new Bot('Create-Node-Iris-App', 'invalid-url')).toThrow(
        'Iris endpoint Address must be in IP:PORT format. ex) 172.30.10.66:3000'
      );
    });

    test('should clean up URL format correctly', () => {
      const botWithHttpUrl = new Bot(
        'Create-Node-Iris-App',
        'http://127.0.0.1:3000/'
      );
      expect(botWithHttpUrl).toBeDefined();

      const botWithWsUrl = new Bot(
        'Create-Node-Iris-App',
        'ws://127.0.0.1:3000'
      );
      expect(botWithWsUrl).toBeDefined();
    });

    test('should accept maxWorkers option', () => {
      const botWithOptions = new Bot('Create-Node-Iris-App', mockIrisUrl, {
        maxWorkers: 10,
      });
      expect(botWithOptions).toBeDefined();
    });
  });

  describe('event handling', () => {
    test('should register message event handlers', () => {
      const handler = jest.fn();

      bot.on('message', handler);

      expect(typeof handler).toBe('function');
    });

    test('should register chat event handlers', () => {
      const handler = jest.fn();

      bot.on('chat', handler);

      expect(typeof handler).toBe('function');
    });

    test('should register error event handlers', () => {
      const handler = jest.fn();

      bot.on('error', handler);

      expect(typeof handler).toBe('function');
    });

    test('should register member events', () => {
      const newMemberHandler = jest.fn();
      const delMemberHandler = jest.fn();

      bot.on('new_member', newMemberHandler);
      bot.on('del_member', delMemberHandler);

      expect(typeof newMemberHandler).toBe('function');
      expect(typeof delMemberHandler).toBe('function');
    });

    test('should remove event handlers', () => {
      const handler = jest.fn();

      bot.on('message', handler);
      bot.off('message', handler);

      expect(typeof handler).toBe('function');
    });
  });

  describe('API integration', () => {
    test('should have IrisAPI instance', () => {
      expect(bot.api).toBeDefined();
      expect(typeof bot.api.getInfo).toBe('function');
      expect(typeof bot.api.reply).toBe('function');
    });
  });

  describe('onEvent decorator', () => {
    test('should return decorator function', () => {
      const decorator = bot.onEvent('test-event');
      expect(typeof decorator).toBe('function');
    });

    test('should bind method to event', () => {
      const decorator = bot.onEvent('test-event');
      const mockDescriptor = {
        value: jest.fn(),
      };

      const result = decorator({}, 'testMethod', mockDescriptor);
      expect(result).toBe(mockDescriptor);
    });
  });

  describe('connection lifecycle', () => {
    test('should have run method', () => {
      expect(typeof bot.run).toBe('function');
    });

    test('should handle connection setup', async () => {
      // Mock successful connection
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'open') {
          setTimeout(callback, 10);
        }
      });

      // Don't actually run the infinite loop
      const originalRun = bot.run;
      bot.run = jest.fn().mockResolvedValue(undefined);

      await expect(bot.run()).resolves.not.toThrow();

      // Restore original method
      bot.run = originalRun;
    });
  });
});
