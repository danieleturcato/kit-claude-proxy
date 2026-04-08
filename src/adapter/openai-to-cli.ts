/**
 * OpenAI to Claude CLI adapter
 * 
 * FIX: Properly handles content blocks (prevents [object Object] bug)
 * FIX: Supports provider-prefixed model names
 * NEW: Extracts system prompts for --system flag
 * NEW: Handles tool definitions
 */

import { 
  OpenAIMessage, 
  ContentBlock, 
  CliInput, 
  ClaudeModel, 
  ToolDefinition 
} from '../types/index.js';

const MODEL_MAP: Record<string, ClaudeModel> = {
  // Direct model names
  'claude-opus-4': 'opus',
  'claude-sonnet-4': 'sonnet',
  'claude-haiku-4': 'haiku',
  // Provider-prefixed names (FIX: was missing!)
  'claude-proxy/claude-opus-4': 'opus',
  'claude-proxy/claude-sonnet-4': 'sonnet',
  'claude-proxy/claude-haiku-4': 'haiku',
  'claude-code-cli/claude-opus-4': 'opus',
  'claude-code-cli/claude-sonnet-4': 'sonnet',
  'claude-code-cli/claude-haiku-4': 'haiku',
  'anthropic/claude-opus-4-6': 'opus',
  'anthropic/claude-sonnet-4-6': 'sonnet',
  'anthropic/claude-haiku-4-5': 'haiku',
  // Aliases
  'opus': 'opus',
  'sonnet': 'sonnet',
  'haiku': 'haiku',
};

/**
 * Extract text from content that may be a string or array of content blocks
 * FIX: Prevents [object Object] bug when content is array
 */
export function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }
  
  if (Array.isArray(content)) {
    // Handle Anthropic-style content blocks
    return content
      .map((block: ContentBlock) => {
        if (block.type === 'text' && block.text) {
          return block.text;
        }
        if (block.type === 'tool_result' && block.content) {
          // Handle tool result content (may be string or array)
          if (typeof block.content === 'string') {
            return block.content;
          }
          if (Array.isArray(block.content)) {
            return block.content
              .map((c: ContentBlock) => c.text || '')
              .join('\n');
          }
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  
  return String(content);
}

/**
 * Extract Claude model alias from request model string
 * FIX: Now supports provider-prefixed model names
 */
export function extractModel(model: string): ClaudeModel {
  // Try direct lookup
  if (MODEL_MAP[model]) {
    return MODEL_MAP[model];
  }
  
  // Try stripping common provider prefixes
  const prefixes = ['claude-proxy/', 'claude-code-cli/', 'anthropic/'];
  for (const prefix of prefixes) {
    const stripped = model.replace(new RegExp(`^${prefix}`), '');
    if (MODEL_MAP[stripped]) {
      return MODEL_MAP[stripped];
    }
  }
  
  // Default to opus for safety
  return 'opus';
}

/**
 * Check if a message contains tool calls
 */
function hasToolCalls(message: OpenAIMessage): boolean {
  return !!(
    message.tool_calls && 
    Array.isArray(message.tool_calls) && 
    message.tool_calls.length > 0
  );
}

/**
 * Format tool calls for CLI prompt
 */
function formatToolCalls(message: OpenAIMessage): string {
  if (!message.tool_calls) return '';
  
  const parts = message.tool_calls.map((call, index) => {
    const args = typeof call.function.arguments === 'string' 
      ? call.function.arguments 
      : JSON.stringify(call.function.arguments);
    
    return `<tool_call_${index}>
<name>${call.function.name}</name>
<arguments>${args}</arguments>
</tool_call_${index}>`;
  });
  
  return `<tool_calls>\n${parts.join('\n')}\n</tool_calls>`;
}

/**
 * Convert OpenAI messages array to CLI input
 * 
 * NEW: Extracts system prompt for --system flag
 * FIX: Handles content blocks properly
 * NEW: Handles tool calls in conversation history
 */
export function openaiToCli(request: {
  messages: OpenAIMessage[];
  model: string;
  user?: string;
  tools?: ToolDefinition[];
}): CliInput {
  let systemPrompt = '';
  const conversationParts: string[] = [];
  
  for (const msg of request.messages) {
    switch (msg.role) {
      case 'system':
        // NEW: Extract system prompt for --system flag
        systemPrompt = extractTextContent(msg.content);
        break;
        
      case 'user':
        // FIX: Use extractTextContent to handle content blocks
        conversationParts.push(`<user>\n${extractTextContent(msg.content)}\n</user>`);
        break;
        
      case 'assistant': {
        let content = extractTextContent(msg.content);
        
        // Handle tool calls in assistant message
        if (hasToolCalls(msg)) {
          content += '\n' + formatToolCalls(msg);
        }
        
        conversationParts.push(`<assistant>\n${content}\n</assistant>`);
        break;
      }
      
      case 'tool': {
        // Tool response message
        const toolContent = extractTextContent(msg.content);
        conversationParts.push(`<tool_result tool_call_id="${msg.tool_call_id || ''}">\n${toolContent}\n</tool_result>`);
        break;
      }
    }
  }
  
  // Build final prompt
  let prompt = conversationParts.join('\n\n');
  
  // Add tool definitions if present
  let tools: ToolDefinition[] | undefined;
  if (request.tools && request.tools.length > 0) {
    tools = request.tools;
    
    // Add tool instructions to system prompt if not already there
    const toolInstructions = `
You have access to the following tools. When you need to use a tool, respond with <tool_calls> blocks containing the tool name and arguments.

Available tools:
${request.tools.map(t => `- ${t.function.name}: ${t.function.description || 'No description'}`).join('\n')}`;
    
    systemPrompt = systemPrompt 
      ? `${systemPrompt}\n\n${toolInstructions}` 
      : toolInstructions;
  }
  
  return {
    prompt,
    model: extractModel(request.model),
    sessionId: request.user,
    system: systemPrompt || undefined,
    tools,
  };
}

/**
 * Convert OpenAI tool definitions to Claude CLI tool format
 * (for future use when CLI supports native tools)
 */
export function toolsToCliFormat(tools: ToolDefinition[]): string {
  return tools.map(tool => {
    return `<tool>
<name>${tool.function.name}</name>
<description>${tool.function.description || ''}</description>
<parameters>${JSON.stringify(tool.function.parameters || {}, null, 2)}</parameters>
</tool>`;
  }).join('\n');
}
