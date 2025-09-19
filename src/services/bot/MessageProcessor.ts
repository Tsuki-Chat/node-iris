import { IrisAPI } from '@/services/core/IrisAPI';
import { IrisRequest, VField } from '@/types/models/base';
import { ChatContext, Room, User } from '@/types/models/classes';
import { Message } from '@/types/models/message';
import { safeJsonParseWithReviver, toSafeId } from '@/utils';
import { Logger } from '@/utils/logger';
import { EventManager } from './EventManager';

export class MessageProcessor {
  private eventManager: EventManager;
  private api: IrisAPI;
  private botId?: string;
  private logger: Logger;

  constructor(eventManager: EventManager, api: IrisAPI) {
    this.eventManager = eventManager;
    this.api = api;
    this.logger = new Logger('MessageProcessor');
  }

  /**
   * Set bot ID
   */
  setBotId(botId: string): void {
    this.botId = botId;
  }

  /**
   * Process incoming Iris request
   */
  async processIrisRequest(req: IrisRequest): Promise<void> {
    let v: VField = {};

    try {
      const vData = req.raw.v;
      if (typeof vData === 'string') {
        v = safeJsonParseWithReviver(vData) as VField;
      } else if (typeof vData === 'object' && vData !== null) {
        v = vData as VField;
      }
    } catch {
      // Ignore JSON parse errors
    }

    const room = new Room(toSafeId(req.raw.chat_id), req.room, this.api);

    const sender = new User(
      toSafeId(req.raw.user_id),
      room.id,
      this.api,
      req.sender,
      this.botId ? toSafeId(this.botId) : undefined
    );

    const message = new Message(
      toSafeId(req.raw.id),
      parseInt(req.raw.type),
      req.raw.message || '',
      req.raw.attachment || '',
      v
    );

    const chat = new ChatContext(room, sender, message, req.raw, this.api);

    await this.processChat(chat);
  }

  /**
   * Process chat context and emit appropriate events
   */
  private async processChat(chat: ChatContext): Promise<void> {
    this.eventManager.emit('chat', [chat]);

    const origin = chat.message.v?.origin;
    const messageType = chat.message.type;
    const isFeedMessage = chat.message.isFeedMessage();

    this.logger.debug('Processing chat message', {
      origin,
      messageType,
      isFeedMessage,
      rawMessage: chat.message.msg,
      vField: chat.message.v,
    });

    switch (origin) {
      case 'MSG':
      case 'WRITE':
        this.logger.debug('Emitting message event');
        this.eventManager.emit('message', [chat]);
        break;
      case 'NEWMEM':
        this.logger.debug('Emitting new_member event');
        this.eventManager.emit('new_member', [chat]);
        break;
      case 'DELMEM':
        this.logger.debug('Emitting del_member event');
        this.eventManager.emit('del_member', [chat]);
        break;
      // Feed message origins
      case 'SYNCDLMSG':
      case 'JOINLINK':
      case 'KICKED':
      case 'SYNCMEMT':
      case 'SYNCREWR':
      case 'FEED':
        this.logger.debug('Emitting feed event', { origin, isFeedMessage });
        this.eventManager.emit('feed', [chat]);
        break;
      default:
        this.logger.debug('Emitting unknown event', { origin });
        this.eventManager.emit('unknown', [chat]);
        break;
    }
  }
}
