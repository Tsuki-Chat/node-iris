/**
 * Additional utility functions for data processing and conversion
 * Useful when porting Python utilities to TypeScript
 */

import { isInteger, isSafeNumber, parse } from 'lossless-json';

/**
 * Async sleep function (similar to Python's asyncio.sleep)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Deep clone utility (useful for data manipulation)
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }

  return cloned;
}

/**
 * Chunk array into smaller arrays (similar to Python's list slicing)
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Create a range of numbers (similar to Python's range())
 */
export function range(
  start: number,
  stop?: number,
  step: number = 1
): number[] {
  if (stop === undefined) {
    stop = start;
    start = 0;
  }

  const result: number[] = [];
  for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
    result.push(i);
  }

  return result;
}

/**
 * Check if value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Custom number parser for ID fields - converts all integers to BigInt
 */
export function parseIdSafely(value: string): bigint | number {
  return isInteger(value) ? BigInt(value) : parseFloat(value);
}

/**
 * Parse and validate number - throws error if number cannot be safely represented
 */
export function parseAndValidateNumber(value: string): number {
  if (!isSafeNumber(value)) {
    throw new Error(`Cannot safely convert value '${value}' into a number`);
  }
  return parseFloat(value);
}

/**
 * Safe JSON parse with lossless-json for large integer handling
 */
export function safeJsonParseWithReviver(jsonString: string): any {
  try {
    // Use lossless-json parse with custom number parser for ID fields
    return parse(jsonString, undefined, (value) => {
      // For integer values, always use BigInt to preserve precision
      if (isInteger(value)) {
        return BigInt(value);
      }

      // For decimal values, validate they can be safely represented as numbers
      if (isSafeNumber(value)) {
        return parseFloat(value);
      }

      // If number is too large for safe representation, keep as string
      return value;
    });
  } catch (error) {
    // Fallback to regular JSON.parse if lossless-json fails
    return JSON.parse(jsonString);
  }
}

/**
 * Convert ID value to string for API compatibility
 */
export function idToString(id: bigint | number | string): string {
  if (typeof id === 'bigint') {
    return id.toString();
  }
  if (typeof id === 'number') {
    return id.toString();
  }
  return id;
}

/**
 * Convert any value to bigint for precise numeric operations
 */
export function idToBigInt(id: bigint | number | string): bigint {
  if (typeof id === 'bigint') {
    return id;
  }
  if (typeof id === 'number') {
    return BigInt(Math.floor(id));
  }
  return BigInt(id);
}

/**
 * Convert input to SafeId (bigint only)
 */
export function toSafeId(id: number | string | bigint): bigint {
  if (typeof id === 'bigint') {
    return id;
  }
  if (typeof id === 'number') {
    return BigInt(Math.floor(id));
  }
  return BigInt(id);
} /**
 * Safe JSON parse with default value and large integer handling
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return safeJsonParseWithReviver(json);
  } catch {
    return defaultValue;
  }
}
