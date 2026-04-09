/**
 * Pre-warmed Process Pool for Claude CLI
 *
 * Maintains a pool of ready Claude CLI processes for faster response times
 * Avoids the overhead of spawning a new process for each request
 */
import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import { ClaudeModel } from '../types/index.js';
interface PoolOptions {
    minSize: number;
    maxSize: number;
    maxIdleTime: number;
    warmupInterval: number;
}
export declare class ProcessPool extends EventEmitter {
    private pool;
    private options;
    private warmupTimer?;
    private cleanupTimer?;
    constructor(options?: Partial<PoolOptions>);
    /**
     * Start pool maintenance (warmup and cleanup)
     */
    private startMaintenance;
    /**
     * Ensure minimum pool size with ready processes
     */
    private warmup;
    /**
     * Remove idle processes exceeding maxIdleTime
     */
    private cleanup;
    /**
     * Create a new pooled process
     */
    private createProcess;
    /**
     * Remove a process from pool and kill it
     */
    private removeProcess;
    /**
     * Acquire a process from the pool
     * Returns a ready process or creates a new one if pool is empty
     */
    acquire(model: ClaudeModel): Promise<ChildProcess>;
    /**
     * Release a process back to the pool
     * The process is killed if pool is at max size
     */
    release(process: ChildProcess, model: ClaudeModel): void;
    /**
     * Get pool statistics
     */
    getStats(): {
        total: number;
        ready: number;
        inUse: number;
    };
    /**
     * Shutdown the pool and kill all processes
     */
    shutdown(): void;
}
export declare function getProcessPool(): ProcessPool;
export declare function shutdownPool(): void;
export {};
//# sourceMappingURL=pool.d.ts.map