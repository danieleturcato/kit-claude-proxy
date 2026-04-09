/**
 * Kit Claude Proxy - Improved Version with Process Pool
 *
 * OpenAI-compatible API proxy for Claude Code CLI with:
 * - Pre-warmed process pool for faster responses
 * - Robust retry logic with exponential backoff
 * - Full tool use support
 * - Improved error handling
 */
export * from './types/index.js';
export * from './adapter/openai-to-cli.js';
export * from './adapter/cli-to-openai.js';
export * from './adapter/tool-parser.js';
export * from './subprocess/manager.js';
export * from './subprocess/pool.js';
export * from './utils/logger.js';
export * from './utils/retry.js';
export declare const VERSION = "1.1.0";
//# sourceMappingURL=index.d.ts.map