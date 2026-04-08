/**
 * Claude CLI to OpenAI adapter
 *
 * NEW: Parses tool calls from CLI output
 * NEW: Properly formats streaming chunks
 * FIX: Handles finish reasons correctly
 */
import { CliResult, OpenAIChatResponse, OpenAIStreamChunk, ToolCall } from '../types/index.js';
/**
 * Parse tool calls from CLI output
 * NEW: Extracts <tool_calls> blocks from response
 */
export declare function parseToolCalls(text: string): {
    text: string;
    toolCalls?: ToolCall[];
};
/**
 * Detect if response contains tool calls
 */
export declare function hasToolCalls(text: string): boolean;
/**
 * Convert CLI result to OpenAI response format
 * NEW: Handles tool calls
 */
export declare function cliResultToOpenai(result: CliResult, requestId: string): OpenAIChatResponse;
/**
 * Create a streaming chunk
 * NEW: Supports tool calls in streaming
 */
export declare function createStreamChunk(requestId: string, model: string, delta: {
    content?: string;
    role?: 'assistant';
    tool_calls?: ToolCall[];
}, finishReason?: 'stop' | 'length' | 'tool_calls' | null): OpenAIStreamChunk;
/**
 * Create the final DONE chunk for streaming
 */
export declare function createDoneChunk(requestId: string, model: string): OpenAIStreamChunk;
//# sourceMappingURL=cli-to-openai.d.ts.map