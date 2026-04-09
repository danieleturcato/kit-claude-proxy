/**
 * Robust retry logic with exponential backoff
 */

import { getLogger } from './logger.js';

const logger = getLogger();

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ETIMEDOUT',
    'ECONNRESET',
    'EPIPE',
    'overloaded',
    'rate_limit',
    'timeout',
  ],
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      logger.debug(`Retry attempt ${attempt}/${opts.maxAttempts}`);
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError.message.toLowerCase();
      
      // Check if error is retryable
      const isRetryable = opts.retryableErrors.some(retryable => 
        errorMessage.includes(retryable.toLowerCase())
      );
      
      if (!isRetryable || attempt === opts.maxAttempts) {
        logger.warn(`Non-retryable error or max attempts reached`, { 
          error: lastError.message,
          attempt,
          isRetryable 
        });
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay
      );
      
      logger.warn(`Retryable error, waiting ${delay}ms before retry`, {
        error: lastError.message,
        attempt,
        nextAttempt: attempt + 1,
      });
      
      await sleep(delay);
    }
  }
  
  throw lastError || new Error('Max retry attempts exceeded');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
