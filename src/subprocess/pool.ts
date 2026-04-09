/**
 * Pre-warmed Process Pool for Claude CLI
 * 
 * Maintains a pool of ready Claude CLI processes for faster response times
 * Avoids the overhead of spawning a new process for each request
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { getLogger } from '../utils/logger.js';
import { ClaudeModel } from '../types/index.js';

const logger = getLogger();

interface PooledProcess {
  process: ChildProcess;
  model: ClaudeModel;
  ready: boolean;
  lastUsed: number;
  sessionId?: string;
}

interface PoolOptions {
  minSize: number;
  maxSize: number;
  maxIdleTime: number;
  warmupInterval: number;
}

const DEFAULT_OPTIONS: PoolOptions = {
  minSize: 2,
  maxSize: 5,
  maxIdleTime: 300000, // 5 minutes
  warmupInterval: 60000, // 1 minute
};

export class ProcessPool extends EventEmitter {
  private pool: PooledProcess[] = [];
  private options: PoolOptions;
  private warmupTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: Partial<PoolOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.startMaintenance();
  }

  /**
   * Start pool maintenance (warmup and cleanup)
   */
  private startMaintenance(): void {
    // Warmup: ensure minimum processes
    this.warmupTimer = setInterval(() => {
      this.warmup();
    }, this.options.warmupInterval);

    // Cleanup: remove idle processes
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 30000); // Every 30 seconds

    // Initial warmup
    this.warmup();
  }

  /**
   * Ensure minimum pool size with ready processes
   */
  private async warmup(): Promise<void> {
    const readyCount = this.pool.filter(p => p.ready).length;
    const needed = this.options.minSize - readyCount;

    if (needed > 0) {
      logger.debug(`Pool warmup: creating ${needed} processes`);
      
      for (let i = 0; i < needed; i++) {
        try {
          await this.createProcess('sonnet'); // Default to sonnet for pool
        } catch (err) {
          logger.warn('Failed to create pooled process', { error: (err as Error).message });
        }
      }
    }
  }

  /**
   * Remove idle processes exceeding maxIdleTime
   */
  private cleanup(): void {
    const now = Date.now();
    const toRemove: PooledProcess[] = [];

    for (const proc of this.pool) {
      if (proc.ready && (now - proc.lastUsed) > this.options.maxIdleTime) {
        toRemove.push(proc);
      }
    }

    // Keep minimum size
    const removableCount = Math.max(0, this.pool.length - toRemove.length - this.options.minSize);
    
    for (let i = 0; i < removableCount && i < toRemove.length; i++) {
      this.removeProcess(toRemove[i]);
    }

    if (toRemove.length > 0) {
      logger.debug(`Pool cleanup: removed ${Math.min(removableCount, toRemove.length)} idle processes`);
    }
  }

  /**
   * Create a new pooled process
   */
  private createProcess(model: ClaudeModel): Promise<PooledProcess> {
    return new Promise((resolve, reject) => {
      const proc = spawn('claude', ['--print', '--model', model], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CLAUDE_CODE_DISABLE_TELEMETRY: '1',
        },
      });

      const pooled: PooledProcess = {
        process: proc,
        model,
        ready: false,
        lastUsed: Date.now(),
      };

      // Wait for process to be ready (stdout ready)
      const onReady = () => {
        pooled.ready = true;
        this.pool.push(pooled);
        logger.debug(`Process added to pool (size: ${this.pool.length})`);
        resolve(pooled);
      };

      // Short timeout to consider process "ready" (CLI starts fast)
      setTimeout(onReady, 100);

      proc.on('error', (err) => {
        reject(err);
      });

      proc.on('exit', (code) => {
        if (!pooled.ready) {
          reject(new Error(`Process exited with code ${code} before ready`));
        } else {
          this.removeProcess(pooled);
        }
      });
    });
  }

  /**
   * Remove a process from pool and kill it
   */
  private removeProcess(pooled: PooledProcess): void {
    const index = this.pool.indexOf(pooled);
    if (index > -1) {
      this.pool.splice(index, 1);
    }

    if (!pooled.process.killed) {
      pooled.process.kill('SIGTERM');
      setTimeout(() => {
        if (!pooled.process.killed) {
          pooled.process.kill('SIGKILL');
        }
      }, 3000);
    }
  }

  /**
   * Acquire a process from the pool
   * Returns a ready process or creates a new one if pool is empty
   */
  async acquire(model: ClaudeModel): Promise<ChildProcess> {
    // Try to find a ready process with matching model
    const matchingIndex = this.pool.findIndex(p => p.ready && p.model === model);
    
    if (matchingIndex > -1) {
      const pooled = this.pool[matchingIndex];
      pooled.ready = false; // Mark as in-use
      pooled.lastUsed = Date.now();
      logger.debug(`Acquired process from pool (${model})`);
      return pooled.process;
    }

    // No matching process available, create new one
    logger.debug(`No pooled process available, creating new one (${model})`);
    const proc = spawn('claude', ['--print', '--model', model], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_CODE_DISABLE_TELEMETRY: '1',
      },
    });

    return proc;
  }

  /**
   * Release a process back to the pool
   * The process is killed if pool is at max size
   */
  release(process: ChildProcess, model: ClaudeModel): void {
    // Find process in pool
    const pooled = this.pool.find(p => p.process === process);
    
    if (pooled) {
      if (this.pool.length >= this.options.maxSize) {
        // Pool full, kill process
        this.removeProcess(pooled);
      } else {
        // Mark as ready for reuse
        pooled.ready = true;
        pooled.lastUsed = Date.now();
        
        // Clear any pending data
        process.stdout?.removeAllListeners('data');
        process.stderr?.removeAllListeners('data');
        
        logger.debug(`Process released back to pool (${model})`);
      }
    } else {
      // Process not in pool, kill it
      if (!process.killed) {
        process.kill('SIGTERM');
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): { total: number; ready: number; inUse: number } {
    return {
      total: this.pool.length,
      ready: this.pool.filter(p => p.ready).length,
      inUse: this.pool.filter(p => !p.ready).length,
    };
  }

  /**
   * Shutdown the pool and kill all processes
   */
  shutdown(): void {
    if (this.warmupTimer) clearInterval(this.warmupTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);

    logger.info('Shutting down process pool', { processes: this.pool.length });
    
    for (const pooled of this.pool) {
      this.removeProcess(pooled);
    }
    
    this.pool = [];
  }
}

// Singleton instance
let globalPool: ProcessPool | null = null;

export function getProcessPool(): ProcessPool {
  if (!globalPool) {
    globalPool = new ProcessPool();
  }
  return globalPool;
}

export function shutdownPool(): void {
  if (globalPool) {
    globalPool.shutdown();
    globalPool = null;
  }
}
