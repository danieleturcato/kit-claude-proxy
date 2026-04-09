/**
 * Tool Call Parser for Claude CLI output
 *
 * Extracts structured tool calls from Claude's text-based tool use format
 */
/**
 * Parse tool calls from Claude CLI text output
 *
 * Claude outputs tools in XML-like format:
 * <tool_call>
 *   <name>function_name</name>
 *   <arguments>{"key": "value"}</arguments>
 * </tool_call>
 */
export function parseToolCallsFromText(text) {
    // Pattern for tool call blocks
    const toolCallPattern = /<tool_call>\s*<name>([^<]+)<\/name>\s*<arguments>([^<]+)<\/arguments>\s*<\/tool_call>/g;
    const toolCalls = [];
    let match;
    let matchCount = 0;
    // Remove tool calls from text and parse them
    const cleanedText = text.replace(toolCallPattern, (fullMatch, name, args) => {
        matchCount++;
        try {
            const parsedArgs = JSON.parse(args.trim());
            toolCalls.push({
                id: `call_${Date.now()}_${matchCount}`,
                type: 'function',
                function: {
                    name: name.trim(),
                    arguments: JSON.stringify(parsedArgs),
                },
            });
            return ''; // Remove from text
        }
        catch (e) {
            // If JSON parsing fails, keep original text
            return fullMatch;
        }
    });
    if (toolCalls.length === 0) {
        return { text };
    }
    return {
        text: cleanedText.trim(),
        toolCalls,
    };
}
/**
 * Alternative format: Claude sometimes uses markdown code blocks
 */
export function parseToolCallsFromMarkdown(text) {
    // Pattern for ```tool or ```json blocks with tool calls
    const codeBlockPattern = /```(?:tool|json)?\s*\n?({[\s\S]*?})\n?```/g;
    const toolCalls = [];
    let match;
    let matchCount = 0;
    const cleanedText = text.replace(codeBlockPattern, (fullMatch, jsonContent) => {
        try {
            const parsed = JSON.parse(jsonContent.trim());
            // Check if this looks like a tool call
            if (parsed.name && (parsed.arguments || parsed.params)) {
                matchCount++;
                toolCalls.push({
                    id: `call_${Date.now()}_${matchCount}`,
                    type: 'function',
                    function: {
                        name: parsed.name,
                        arguments: JSON.stringify(parsed.arguments || parsed.params),
                    },
                });
                return '';
            }
            return fullMatch; // Not a tool call, keep it
        }
        catch (e) {
            return fullMatch; // Not valid JSON, keep it
        }
    });
    if (toolCalls.length === 0) {
        return { text };
    }
    return {
        text: cleanedText.trim(),
        toolCalls,
    };
}
/**
 * Main parser that tries multiple formats
 */
export function extractToolCalls(text) {
    // Try XML format first
    let result = parseToolCallsFromText(text);
    if (result.toolCalls) {
        return result;
    }
    // Try markdown format
    result = parseToolCallsFromMarkdown(text);
    if (result.toolCalls) {
        return result;
    }
    return { text };
}
/**
 * Format tool calls for OpenAI response
 */
export function formatToolCallsForOpenAI(toolCalls) {
    return JSON.stringify(toolCalls.map(tc => ({
        id: tc.id,
        type: tc.type,
        function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
        },
    })));
}
/**
 * Create tool result content block
 */
export function createToolResultBlock(toolCallId, content) {
    return {
        type: 'tool_result',
        content,
    };
}
//# sourceMappingURL=tool-parser.js.map