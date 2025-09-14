/**
 * Common type definitions for the iris application
 */

// Base interfaces
export interface IrisConfig {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  timeout: number;
  retryAttempts: number;
}

export interface ProcessingOptions {
  async?: boolean;
  timeout?: number;
  retries?: number;
}

export interface ProcessingResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

// Data types that might be commonly used when porting from Python
export interface DataPoint {
  id: string | number;
  value: any;
  metadata?: Record<string, any>;
}

export interface ProcessingContext {
  requestId: string;
  startTime: Date;
  options: ProcessingOptions;
}

// Error types
export class IrisError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'IrisError';
  }
}

export class ValidationError extends IrisError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class ProcessingError extends IrisError {
  constructor(message: string, details?: any) {
    super(message, 'PROCESSING_ERROR', details);
    this.name = 'ProcessingError';
  }
}

// Utility types
export type AsyncFunction<T = any, R = any> = (input: T) => Promise<R>;
export type SyncFunction<T = any, R = any> = (input: T) => R;
export type ProcessingFunction<T = any, R = any> =
  | AsyncFunction<T, R>
  | SyncFunction<T, R>;

// Event types (useful for porting event-driven Python code)
export interface EventData {
  type: string;
  payload: any;
  timestamp: Date;
}

export type EventHandler<T = any> = (data: T) => void | Promise<void>;

export interface IIrisAPI {
  // Core methods matching Python iris API
  reply(roomId: string | number, message: string): Promise<any>;
  replyMedia(roomId: string | number, files: Buffer[]): Promise<any>;

  // Enhanced image URL methods
  replyImageUrls(roomId: string | number, imageUrls: string[]): Promise<any>;
  replyImageUrl(roomId: string | number, imageUrl: string): Promise<any>;

  decrypt(
    enc: number,
    b64Ciphertext: string,
    userId: string | number
  ): Promise<string | null>;
  query(query: string, bind?: any[]): Promise<any[]>;
  getInfo(): Promise<any>;
  getAot(): Promise<any>;
}

// Re-export models for backward compatibility
export * from './models/index';
