/**
 * Configuration management using environment variables
 */

import { config } from 'dotenv';

// Load environment variables from .env file
config();

export interface IrisConfig {
  irisUrl: string;
  maxWorkers?: number;
  bannedUsers?: string[];
  // Add other configuration options as needed
}

export class Config {
  private static instance: Config;
  private config: IrisConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private loadConfig(): IrisConfig {
    const irisUrl = process.env.IRIS_URL;

    if (!irisUrl) {
      throw new Error('IRIS_URL environment variable is required');
    }

    const maxWorkers = process.env.MAX_WORKERS
      ? parseInt(process.env.MAX_WORKERS)
      : undefined;

    const bannedUsers = process.env.BANNED_USERS
      ? process.env.BANNED_USERS.split(',').map((id) => id.trim())
      : [];

    return {
      irisUrl,
      maxWorkers,
      bannedUsers,
    };
  }

  public get(key: keyof IrisConfig): any {
    return this.config[key];
  }

  public getAll(): IrisConfig {
    return { ...this.config };
  }

  public update(key: keyof IrisConfig, value: any): void {
    (this.config as any)[key] = value;
  }

  // Convenience getters
  public get irisUrl(): string {
    return this.config.irisUrl;
  }

  public get maxWorkers(): number | undefined {
    return this.config.maxWorkers;
  }

  public get bannedUsers(): string[] {
    return this.config.bannedUsers || [];
  }
}
