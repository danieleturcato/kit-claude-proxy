/**
 * OpenAI to Claude CLI adapter
 *
 * FIX: Properly handles content blocks (prevents [object Object] bug)
 * FIX: Supports provider-prefixed model names
 * NEW: Extracts system prompts for --system flag
 * NEW: Handles tool definitions
 */
import { OpenAIMessage, ContentBlock, CliInput, ClaudeModel, ToolDefinition } from '../types/index.js';
/**
 * Extract text from content that may be a string or array of content blocks
 * FIX: Prevents [object Object] bug when content is array
 */
export declare function extractTextContent(content: string | ContentBlock[]): string;
/**
 * Extract Claude model alias from request model string
 * FIX: Now supports provider-prefixed model names
 */
export declare function extractModel(model: string): ClaudeModel;
/**
 * Convert OpenAI messages array to CLI input
 *
 * NEW: Extracts system prompt for --system flag
 * FIX: Handles content blocks properly
 * NEW: Handles tool calls in conversation history
 */
export declare function openaiToCli(request: {
    messages: OpenAIMessage[];
    model: string;
    user?: string;
    tools?: ToolDefinition[];
}): CliInput;
/**
 * Convert OpenAI tool definitions to Claude CLI tool format
 * (for future use when CLI supports native tools)
 */
export declare function toolsToCliFormat(tools: ToolDefinition[]): string;
//# sourceMappingURL=openai-to-cli.d.ts.map