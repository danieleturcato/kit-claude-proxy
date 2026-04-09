/**
 * Tool Call Parser for Claude CLI output
 *
 * Extracts structured tool calls from Claude's text-based tool use format
 */
import { ToolCall, ContentBlock } from '../types/index.js';
/**
 * Parse tool calls from Claude CLI text output
 *
 * Claude outputs tools in XML-like format:
 * <tool_call>
 *   <name>function_name</name>
 *   <arguments>{"key": "value"}</arguments>
 * </tool_call>
 */
export declare function parseToolCallsFromText(text: string): {
    text: string;
    toolCalls?: ToolCall[];
};
/**
 * Alternative format: Claude sometimes uses markdown code blocks
 */
export declare function parseToolCallsFromMarkdown(text: string): {
    text: string;
    toolCalls?: ToolCall[];
};
/**
 * Main parser that tries multiple formats
 */
export declare function extractToolCalls(text: string): {
    text: string;
    toolCalls?: ToolCall[];
};
/**
 * Format tool calls for OpenAI response
 */
export declare function formatToolCallsForOpenAI(toolCalls: ToolCall[]): string;
/**
 * Create tool result content block
 */
export declare function createToolResultBlock(toolCallId: string, content: string): ContentBlock;
//# sourceMappingURL=tool-parser.d.ts.map