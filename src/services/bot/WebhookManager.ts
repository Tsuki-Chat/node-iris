import express = require('express');
import { IrisRequest } from '@/types/models/base';
import { Logger } from '@/utils/logger';

export interface WebhookManagerOptions {
  port?: number;
  path?: string;
}

export class WebhookManager {
  private expressApp?: express.Application;
  private httpServer?: any;
  private logger: Logger;
  private webhookPort: number;
  private webhookPath: string;
  private botName: string;
  private onMessageCallback?: (data: IrisRequest) => Promise<void>;

  constructor(
    botName: string,
    logger: Logger,
    options: WebhookManagerOptions = {}
  ) {
    this.botName = botName;
    this.logger = logger;
    this.webhookPort = options.port || 3001;
    this.webhookPath = options.path || '/webhook/message';
  }

  /**
   * Set the callback for processing incoming webhook messages
   */
  setMessageHandler(callback: (data: IrisRequest) => Promise<void>): void {
    this.onMessageCallback = callback;
  }

  /**
   * Setup and start the webhook server
   */
  start(): void {
    this.expressApp = express();

    // Body parser middleware with increased limits for large messages
    this.expressApp.use(
      express.json({
        limit: '50mb',
        type: ['application/json', 'text/plain'],
      })
    );
    this.expressApp.use(
      express.urlencoded({
        extended: true,
        limit: '50mb',
        parameterLimit: 50000,
      })
    );

    // Health check endpoint
    this.expressApp.get('/health', (req, res) => {
      res.json({ status: 'OK', mode: 'webhook', bot: this.botName });
    });

    // Webhook endpoint
    this.expressApp.post(this.webhookPath, async (req, res) => {
      try {
        const requestData = req.body;

        this.logger.debug('Webhook received data:', requestData);

        if (!requestData) {
          res.status(400).json({ error: 'No data received' });
          return;
        }

        // Convert webhook data to IrisRequest format
        let irisRequest: IrisRequest;

        if (requestData.json) {
          // If data has 'json' field, use it as raw data
          irisRequest = {
            room: requestData.room,
            sender: requestData.sender,
            raw: requestData.json,
          };
        } else if (requestData.raw) {
          // If data already has 'raw' field (standard IrisRequest format)
          irisRequest = requestData as IrisRequest;
        } else {
          // Try to use the entire request body as raw data
          irisRequest = {
            room: requestData.room || 'Unknown',
            sender: requestData.sender || 'Unknown',
            raw: requestData,
          };
        }

        this.logger.debug('Processed IrisRequest:', {
          room: irisRequest.room,
          sender: irisRequest.sender,
          rawKeys: Object.keys(irisRequest.raw),
        });

        // Process the request
        if (this.onMessageCallback) {
          await this.onMessageCallback(irisRequest);
        }

        res.json({ status: 'OK', processed: true });
      } catch (error) {
        this.logger.error('Webhook processing error:', error);

        res.status(500).json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Start HTTP server
    this.httpServer = this.expressApp.listen(this.webhookPort, () => {
      this.logger.info(
        `HTTP webhook server started on port ${this.webhookPort}`
      );
      this.logger.info(`Webhook endpoint: POST ${this.webhookPath}`);
    });
  }

  /**
   * Stop the webhook server
   */
  stop(): void {
    if (this.httpServer) {
      this.httpServer.close(() => {
        this.logger.info('HTTP webhook server stopped');
      });
    }
  }

  /**
   * Keep the process alive in webhook mode
   */
  async keepAlive(): Promise<void> {
    return new Promise(() => {
      // Process will stay alive due to HTTP server
    });
  }
}
