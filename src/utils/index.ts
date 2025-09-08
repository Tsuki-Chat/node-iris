/**
 * Additional utility functions for data processing and conversion
 * Useful when porting Python utilities to TypeScript
 */

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
 * Safe JSON parse with large integer handling - preprocesses string before parsing
 */
export function safeJsonParseWithReviver(jsonString: string): any {
  // JSON 파싱 전에 특정 필드의 큰 정수를 문자열로 사전 처리
  let preprocessed = jsonString
    // userId, user_id, userid 필드의 16자리 이상 정수를 문자열로 변환
    .replace(
      /"(userId|user_id|userid)":\s*(-?\d{16,})(?=\s*[,\}])/g,
      '"$1":"$2"'
    )
    // logId, log_id, logid 필드의 16자리 이상 정수를 문자열로 변환
    .replace(/"(logId|log_id|logid)":\s*(-?\d{16,})(?=\s*[,\}])/g, '"$1":"$2"')
    // chatId, chat_id, chatid 필드의 16자리 이상 정수를 문자열로 변환
    .replace(
      /"(chatId|chat_id|chatid)":\s*(-?\d{16,})(?=\s*[,\}])/g,
      '"$1":"$2"'
    )
    // roomId, room_id, roomid 필드의 16자리 이상 정수를 문자열로 변환
    .replace(
      /"(roomId|room_id|roomid)":\s*(-?\d{16,})(?=\s*[,\}])/g,
      '"$1":"$2"'
    )
    // src_logId, src_linkId, src_userId 필드의 16자리 이상 정수를 문자열로 변환
    .replace(
      /"(src_logId|src_linkId|src_userId)":\s*(-?\d{16,})(?=\s*[,\}])/g,
      '"$1":"$2"'
    );

  return JSON.parse(preprocessed, (key, value) => {
    // 지정된 필드들은 항상 문자열로 처리
    if (
      ['userId', 'user_id', 'userid', 'logId', 'log_id', 'logid'].includes(
        key
      ) &&
      typeof value === 'number'
    ) {
      return value.toString();
    }
    // 큰 정수 (JavaScript의 안전한 정수 범위를 초과하는 경우) 처리
    if (typeof value === 'number' && !Number.isSafeInteger(value)) {
      return value.toString();
    }
    return value;
  });
}

/**
 * Safe JSON parse with default value and large integer handling
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return safeJsonParseWithReviver(json);
  } catch {
    return defaultValue;
  }
}
