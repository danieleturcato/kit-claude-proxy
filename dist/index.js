/**
 * Kit Claude Proxy
 *
 * OpenAI-compatible API proxy for Claude Code CLI.
 *
 * Features:
 * - Fixes [object Object] bug with content block handling
 * - Supports provider-prefixed model names (claude-proxy/...)
 * - Tool calls support
 * - Structured logging
 * - Concurrency limiting
 * - Graceful shutdown
 */
export * from './types/index.js';
export * from './adapter/openai-to-cli.js';
export * from './adapter/cli-to-openai.js';
export * from './subprocess/manager.js';
export * from './utils/logger.js';
//# sourceMappingURL=index.js.map