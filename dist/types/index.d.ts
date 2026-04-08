/**
 * Type definitions for kit-claude-proxy
 */
export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | ContentBlock[];
    name?: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}
export interface ContentBlock {
    type: 'text' | 'image' | 'tool_use' | 'tool_result';
    text?: string;
    source?: {
        type: 'base64' | 'url';
        media_type?: string;
        data?: string;
        url?: string;
    };
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    content?: string | ContentBlock[];
}
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters?: Record<string, unknown>;
    };
}
export interface OpenAIChatRequest {
    model: string;
    messages: OpenAIMessage[];
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    user?: string;
    tools?: ToolDefinition[];
    tool_choice?: 'auto' | 'none' | {
        type: 'function';
        function: {
            name: string;
        };
    };
}
export interface OpenAIChatResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: {
        index: number;
        message: {
            role: 'assistant';
            content: string | null;
            tool_calls?: ToolCall[];
        };
        finish_reason: 'stop' | 'length' | 'tool_calls' | null;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export interface OpenAIStreamChunk {
    id: string;
    object: 'chat.completion.chunk';
    created: number;
    model: string;
    choices: {
        index: number;
        delta: {
            role?: 'assistant';
            content?: string;
            tool_calls?: ToolCall[];
        };
        finish_reason: 'stop' | 'length' | 'tool_calls' | null;
    }[];
}
export type ClaudeModel = 'opus' | 'sonnet' | 'haiku';
export interface CliInput {
    prompt: string;
    model: ClaudeModel;
    sessionId?: string;
    system?: string;
    tools?: ToolDefinition[];
}
export interface CliResult {
    text: string;
    toolCalls?: ToolCall[];
    finishReason: 'stop' | 'length' | 'tool_calls';
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export interface SubprocessEvents {
    result: (result: CliResult) => void;
    error: (error: Error) => void;
    close: (code: number | null) => void;
    chunk: (chunk: string) => void;
}
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface Logger {
    debug: (message: string, meta?: Record<string, unknown>) => void;
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
}
export interface ServerConfig {
    port: number;
    host: string;
    maxConcurrentRequests: number;
    requestTimeoutMs: number;
    logLevel: LogLevel;
    version: string;
}
//# sourceMappingURL=index.d.ts.map