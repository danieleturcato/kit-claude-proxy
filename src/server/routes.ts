/**
 * API Route Handlers
 * 
 * Implements OpenAI-compatible endpoints
 * NEW: Better error handling with proper HTTP codes
 * NEW: Concurrency limiting
 * FIX: Proper content-type handling
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ClaudeSubprocess } from '../subprocess/manager.js';
import { openaiToCli, extractModel } from '../adapter/openai-to-cli.js';
import { 
  cliResultToOpenai, 
  parseToolCalls, 
  createStreamChunk, 
  createDoneChunk 
} from '../adapter/cli-to-openai.js';
import { getLogger } from '../utils/logger.js';
import { OpenAIChatRequest } from '../types/index.js';

const logger = getLogger();

// NEW: Semaphore for concurrency limiting
class Semaphore {
  private permits: number;
  private waiters: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  release(): void {
    if (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.();
    } else {
      this.permits++;
    }
  }
}

// NEW: Global semaphore (max concurrent requests)
const requestSemaphore = new Semaphore(3);

/**
 * Handle POST /v1/chat/completions
 */
export async function handleChatCompletions(req: Request, res: Response): Promise<void> {
  const requestId = uuidv4().replace(/-/g, '').slice(0, 24);
  
  // NEW: Acquire semaphore
  await requestSemaphore.acquire();
  
  try {
    const body = req.body as OpenAIChatRequest;
    const stream = body.stream === true;

    logger.info('Chat completion request', { 
      requestId, 
      model: body.model,
      stream,
      messageCount: body.messages?.length,
    });

    // Validate request
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      res.status(400).json({
        error: {
          message: "messages is required and must be a non-empty array",
          type: "invalid_request_error",
          code: "invalid_messages",
        },
      });
      return;
    }

    // Validate model
    const model = extractModel(body.model);
    logger.debug('Resolved model', { requestModel: body.model, resolvedModel: model });

    // Convert to CLI input
    const cliInput = openaiToCli(body);
    const subprocess = new ClaudeSubprocess();

    if (stream) {
      await handleStreamingResponse(req, res, subprocess, cliInput, requestId, body.model);
    } else {
      await handleNonStreamingResponse(res, subprocess, cliInput, requestId, body.model);
    }

  } catch (error) {
    const err = error as Error;
    logger.error('Error in chat completions', { 
      requestId, 
      error: err.message,
      stack: err.stack,
    });
    
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: err.message,
          type: "server_error",
          code: "internal_error",
        },
      });
    }
  } finally {
    // NEW: Always release semaphore
    requestSemaphore.release();
  }
}

/**
 * Handle streaming response (Server-Sent Events)
 */
async function handleStreamingResponse(
  req: Request,
  res: Response,
  subprocess: ClaudeSubprocess,
  cliInput: { prompt: string; model: string; system?: string },
  requestId: string,
  modelName: string
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let textBuffer = '';
  let isFinished = false;

  // Handle incoming chunks
  subprocess.on('chunk', (chunk: string) => {
    if (isFinished) return;
    
    textBuffer += chunk;
    
    // Send as SSE
    const streamChunk = createStreamChunk(requestId, modelName, { content: chunk });
    res.write(`data: ${JSON.stringify(streamChunk)}\n\n`);
  });

  // Handle completion
  subprocess.on('close', (code) => {
    if (isFinished) return;
    isFinished = true;

    if (code === 0 && textBuffer) {
      // Parse tool calls if any
      const { text, toolCalls } = parseToolCalls(textBuffer);
      
      // Send final chunk with tool calls if present
      if (toolCalls) {
        const toolChunk = createStreamChunk(requestId, modelName, {}, 'tool_calls');
        res.write(`data: ${JSON.stringify(toolChunk)}\n\n`);
      } else {
        const doneChunk = createDoneChunk(requestId, modelName);
        res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
      }
      
      res.write('data: [DONE]\n\n');
    } else if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: `Claude CLI exited with code ${code}`,
          type: "server_error",
        },
      });
    }
    
    res.end();
  });

  // Handle errors
  subprocess.on('error', (error: Error) => {
    logger.error('Streaming error', { error: error.message });
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: error.message,
          type: "server_error",
        },
      });
    }
    res.end();
  });

  // Start subprocess
  await subprocess.start(cliInput.prompt, {
    model: cliInput.model as any,
    sessionId: requestId,
    system: cliInput.system,
  });
}

/**
 * Handle non-streaming response
 */
async function handleNonStreamingResponse(
  res: Response,
  subprocess: ClaudeSubprocess,
  cliInput: { prompt: string; model: string; system?: string },
  requestId: string,
  modelName: string
): Promise<void> {
  return new Promise((resolve) => {
    let finalResult: { text: string; toolCalls?: any[] } | null = null;
    let error: Error | null = null;

    subprocess.on('result', (result) => {
      // Parse tool calls from result
      const { text, toolCalls } = parseToolCalls(result.text);
      finalResult = { text, toolCalls };
    });

    subprocess.on('error', (err) => {
      error = err;
    });

    subprocess.on('close', (code) => {
      if (error) {
        logger.error('Subprocess error', { error: error.message });
        res.status(500).json({
          error: {
            message: error.message,
            type: "server_error",
          },
        });
      } else if (finalResult) {
        const result = cliResultToOpenai(
          {
            text: finalResult.text,
            toolCalls: finalResult.toolCalls,
            finishReason: finalResult.toolCalls ? 'tool_calls' : 'stop',
          },
          requestId
        );
        // Override model name
        result.model = modelName;
        res.json(result);
      } else {
        res.status(500).json({
          error: {
            message: `Claude CLI exited with code ${code} without response`,
            type: "server_error",
          },
        });
      }
      resolve();
    });

    // Start subprocess
    subprocess.start(cliInput.prompt, {
      model: cliInput.model as any,
      sessionId: requestId,
      system: cliInput.system,
    }).catch((err) => {
      logger.error('Failed to start subprocess', { error: err.message });
      res.status(500).json({
        error: {
          message: err.message,
          type: "server_error",
        },
      });
      resolve();
    });
  });
}

/**
 * Handle GET /v1/models
 * NEW: Returns proper OpenAI-compatible model list
 */
export function handleListModels(req: Request, res: Response): void {
  logger.debug('List models request');
  
  res.json({
    object: 'list',
    data: [
      {
        id: 'claude-opus-4',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'anthropic',
      },
      {
        id: 'claude-sonnet-4',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'anthropic',
      },
      {
        id: 'claude-haiku-4',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'anthropic',
      },
      // Provider-prefixed variants
      {
        id: 'claude-proxy/claude-opus-4',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'anthropic',
      },
      {
        id: 'claude-proxy/claude-sonnet-4',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'anthropic',
      },
      {
        id: 'claude-proxy/claude-haiku-4',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'anthropic',
      },
    ],
  });
}

/**
 * Handle GET /health
 * NEW: Enhanced health check with version info
 */
export function handleHealth(req: Request, res: Response): void {
  res.json({
    status: 'ok',
    provider: 'kit-claude-proxy',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    features: {
      streaming: true,
      tool_calls: true,
      system_prompts: true,
    },
  });
}
