/**
 * Claude CLI to OpenAI adapter
 *
 * NEW: Parses tool calls from CLI output
 * NEW: Properly formats streaming chunks
 * FIX: Handles finish reasons correctly
 */
/**
 * Parse tool calls from CLI output
 * NEW: Extracts <tool_calls> blocks from response
 */
export function parseToolCalls(text) {
    const toolCallRegex = /<tool_calls>\s*([\s\S]*?)<\/tool_calls>/;
    const match = text.match(toolCallRegex);
    if (!match) {
        return { text };
    }
    // Remove tool_calls block from text
    const cleanText = text.replace(toolCallRegex, '').trim();
    // Parse individual tool calls
    const toolCallsBlock = match[1];
    const toolCallRegex2 = /<tool_call_(\d+)>\s*<name>(.*?)<\/name>\s*<arguments>([\s\S]*?)<\/arguments>\s*<\/tool_call_\d+>/g;
    const toolCalls = [];
    let m;
    while ((m = toolCallRegex2.exec(toolCallsBlock)) !== null) {
        toolCalls.push({
            id: `call_${Date.now()}_${m[1]}`,
            type: 'function',
            function: {
                name: m[2].trim(),
                arguments: m[3].trim(),
            },
        });
    }
    // If no tool calls parsed but block existed, return original
    if (toolCalls.length === 0) {
        return { text };
    }
    return {
        text: cleanText || null,
        toolCalls,
    };
}
/**
 * Detect if response contains tool calls
 */
export function hasToolCalls(text) {
    return /<tool_calls>/.test(text);
}
/**
 * Convert CLI result to OpenAI response format
 * NEW: Handles tool calls
 */
export function cliResultToOpenai(result, requestId) {
    const created = Math.floor(Date.now() / 1000);
    return {
        id: `chatcmpl-${requestId}`,
        object: 'chat.completion',
        created,
        model: 'claude-opus-4', // Map back to canonical name
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: result.text || null,
                    tool_calls: result.toolCalls,
                },
                finish_reason: result.finishReason,
            },
        ],
        usage: result.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        },
    };
}
/**
 * Create a streaming chunk
 * NEW: Supports tool calls in streaming
 */
export function createStreamChunk(requestId, model, delta, finishReason = null) {
    return {
        id: `chatcmpl-${requestId}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
            {
                index: 0,
                delta,
                finish_reason: finishReason,
            },
        ],
    };
}
/**
 * Create the final DONE chunk for streaming
 */
export function createDoneChunk(requestId, model) {
    return {
        id: `chatcmpl-${requestId}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
            {
                index: 0,
                delta: {},
                finish_reason: 'stop',
            },
        ],
    };
}
//# sourceMappingURL=cli-to-openai.js.map