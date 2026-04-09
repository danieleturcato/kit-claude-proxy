/**
 * Robust retry logic with exponential backoff
 */
export interface RetryOptions {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors: string[];
}
export declare function withRetry<T>(operation: () => Promise<T>, options?: Partial<RetryOptions>): Promise<T>;
//# sourceMappingURL=retry.d.ts.map