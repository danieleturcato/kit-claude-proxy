/**
 * Kit Claude Proxy - Improved Version with Process Pool
 * 
 * OpenAI-compatible API proxy for Claude Code CLI with:
 * - Pre-warmed process pool for faster responses
 * - Robust retry logic with exponential backoff
 * - Full tool use support
 * - Improved error handling
 */

// Core types
export * from './types/index.js';

// Adapters
export * from './adapter/openai-to-cli.js';
export * from './adapter/cli-to-openai.js';
export * from './adapter/tool-parser.js';

// Subprocess management
export * from './subprocess/manager.js';
export * from './subprocess/pool.js';

// Utilities
export * from './utils/logger.js';
export * from './utils/retry.js';

// Version
export const VERSION = '1.1.0';
