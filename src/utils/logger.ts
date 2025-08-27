import winston from 'winston';
import path from 'path';
import { FeedType } from '@/types/models';

// 로그 레벨 정의
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// 로그 포맷 설정
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    // 메타데이터가 있으면 추가
    if (Object.keys(meta).length > 0) {
      log += ' ' + JSON.stringify(meta);
    }

    // 스택 트레이스가 있으면 추가
    if (stack) {
      log += '\n' + stack;
    }

    return log;
  })
);

// 기본 로거 생성
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // 콘솔 출력 - 컬러 포맷 분리
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, stack, ...meta }) => {
            let log = `[${timestamp}] [${level}] ${message}`;

            // 메타데이터가 있으면 추가
            if (Object.keys(meta).length > 0) {
              log += ' ' + JSON.stringify(meta);
            }

            // 스택 트레이스가 있으면 추가
            if (stack) {
              log += '\n' + stack;
            }

            return log;
          }
        )
      ),
    }),

    // 파일 출력 - 모든 로그 (채팅 로그 제외)
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'app.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format((info) => {
          // 채팅 로그는 파일에 저장하지 않음
          if (
            typeof info.message === 'string' &&
            info.message.includes('[MSG]')
          ) {
            return false;
          }
          return info;
        })(),
        logFormat
      ),
    }),

    // 파일 출력 - 에러만
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],

  // 처리되지 않은 예외 캐치
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
    }),
  ],

  // 처리되지 않은 Promise rejection 캐치
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log'),
    }),
  ],
});

// 로거 래퍼 클래스
export class Logger {
  private context: string;
  private saveChatLogs: boolean;
  private chatLogger?: winston.Logger;

  constructor(
    context: string = 'App',
    options: { saveChatLogs?: boolean } = {}
  ) {
    this.context = context;
    this.saveChatLogs = options.saveChatLogs || false;

    // 채팅 로그 저장이 활성화된 경우 별도 로거 생성
    if (this.saveChatLogs) {
      this.chatLogger = winston.createLogger({
        level: 'info',
        format: logFormat,
        transports: [
          new winston.transports.File({
            filename: path.join(process.cwd(), 'logs', 'chat.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
        ],
      });
    }
  }

  private formatMessage(message: string): string {
    return `[${this.context}] ${message}`;
  }

  error(message: string, error?: Error | any, meta?: any): void {
    if (error instanceof Error) {
      logger.error(this.formatMessage(message), {
        error: error.message,
        stack: error.stack,
        ...meta,
      });
    } else if (error) {
      logger.error(this.formatMessage(message), { error, ...meta });
    } else {
      logger.error(this.formatMessage(message), meta);
    }
  }

  warn(message: string, meta?: any): void {
    logger.warn(this.formatMessage(message), meta);
  }

  info(message: string, meta?: any): void {
    logger.info(this.formatMessage(message), meta);
  }

  debug(message: string, meta?: any): void {
    logger.debug(this.formatMessage(message), meta);
  }

  // 채팅 관련 특별한 로그 메서드들
  chat(
    type: string,
    roomName: string,
    senderName: string,
    message: string | FeedType
  ): void {
    const logMessage = this.formatMessage(
      `[${type}] [${roomName}] ${senderName}: ${message}`
    );

    // 콘솔에는 항상 출력
    logger.info(logMessage);

    // 파일 저장은 옵션에 따라
    if (this.saveChatLogs && this.chatLogger) {
      this.chatLogger.info(logMessage);
    }
  }

  command(roomName: string, senderName: string, command: string): void {
    logger.info(
      this.formatMessage(
        `[CMD] [${roomName}] ${senderName} executed command: ${command}`
      )
    );
  }

  newMember(roomName: string, memberName: string): void {
    logger.info(this.formatMessage(`[NEWMEM] [${roomName}]: ${memberName}`));
  }

  delMember(roomName: string, memberName: string): void {
    logger.info(this.formatMessage(`[DELMEM] [${roomName}]: ${memberName}`));
  }
}

// 기본 로거 인스턴스 생성
export const defaultLogger = new Logger('IrisBot');

// winston 로거 직접 접근
export { logger as winstonLogger };

export default Logger;
