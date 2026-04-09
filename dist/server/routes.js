/**
 * API Route Handlers - Improved Version with Process Pool & Retry
 *
 * Implements OpenAI-compatible endpoints with:
 * - Pre-warmed process pool for faster responses
 * - Robust retry logic with exponential backoff
 * - Full tool use support
 * - Improved error handling
 */
import { v4 as uuidv4 } from 'uuid';
import { getProcessPool } from '../subprocess/pool.js';
import { openaiToCli, extractModel } from '../adapter/openai-to-cli.js';
import { cliResultToOpenai, createStreamChunk, createDoneChunk } from '../adapter/cli-to-openai.js';
import { extractToolCalls } from '../adapter/tool-parser.js';
import { withRetry } from '../utils/retry.js';
import { getLogger } from '../utils/logger.js';
const logger = getLogger();
const pool = getProcessPool();
/**
 * Handle POST /v1/chat/completions
 * NEW: Uses process pool and retry logic
 */
export async function handleChatCompletions(req, res) {
    const requestId = uuidv4().replace(/-/g, '').slice(0, 24);
    try {
        const body = req.body;
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
        if (stream) {
            await handleStreamingResponse(req, res, cliInput, requestId, body.model, model);
        }
        else {
            await handleNonStreamingResponse(res, cliInput, requestId, body.model, model);
        }
    }
    catch (error) {
        const err = error;
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
    }
}
/**
 * Handle streaming response with retry logic
 */
async function handleStreamingResponse(req, res, cliInput, requestId, modelName, model) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    let textBuffer = '';
    let isFinished = false;
    try {
        // Use retry logic for the entire operation
        await withRetry(async () => {
            const proc = await pool.acquire(model);
            return new Promise((resolve, reject) => {
                // Handle incoming chunks
                proc.stdout?.on('data', (data) => {
                    if (isFinished)
                        return;
                    const chunk = data.toString();
                    textBuffer += chunk;
                    // Send as SSE
                    const streamChunk = createStreamChunk(requestId, modelName, { content: chunk });
                    res.write(`data: ${JSON.stringify(streamChunk)}\n\n`);
                });
                // Handle completion
                proc.on('close', (code) => {
                    if (isFinished)
                        return;
                    isFinished = true;
                    if (code === 0 && textBuffer) {
                        // Parse tool calls if any
                        const { text, toolCalls } = extractToolCalls(textBuffer);
                        // Send final chunk with tool calls if present
                        if (toolCalls) {
                            const toolChunk = createStreamChunk(requestId, modelName, {}, 'tool_calls');
                            res.write(`data: ${JSON.stringify(toolChunk)}\n\n`);
                        }
                        else {
                            const doneChunk = createDoneChunk(requestId, modelName);
                            res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
                        }
                        res.write('data: [DONE]\n\n');
                        pool.release(proc, model);
                        resolve();
                    }
                    else {
                        pool.release(proc, model);
                        reject(new Error(`Claude CLI exited with code ${code}`));
                    }
                });
                // Handle errors
                proc.on('error', (error) => {
                    logger.error('Streaming error', { error: error.message });
                    pool.release(proc, model);
                    reject(error);
                });
                // Send prompt
                proc.stdin?.write(cliInput.prompt + '\n', (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        proc.stdin?.end();
                    }
                });
            });
        }, {
            maxAttempts: 3,
            initialDelay: 500,
            retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'exited with code'],
        });
    }
    catch (error) {
        logger.error('Streaming failed after retries', { error: error.message });
        if (!res.headersSent) {
            res.status(500).json({
                error: {
                    message: error.message,
                    type: "server_error",
                },
            });
        }
        res.end();
    }
}
/**
 * Handle non-streaming response with retry logic
 */
async function handleNonStreamingResponse(res, cliInput, requestId, modelName, model) {
    try {
        const result = await withRetry(async () => {
            const proc = await pool.acquire(model);
            return new Promise((resolve, reject) => {
                let output = '';
                let errorOutput = '';
                proc.stdout?.on('data', (data) => {
                    output += data.toString();
                });
                proc.stderr?.on('data', (data) => {
                    errorOutput += data.toString();
                });
                proc.on('close', (code) => {
                    pool.release(proc, model);
                    if (code === 0) {
                        // Parse tool calls from output
                        const { text, toolCalls } = extractToolCalls(output);
                        resolve({ text, toolCalls });
                    }
                    else {
                        reject(new Error(`Claude CLI exited with code ${code}: ${errorOutput || output}`));
                    }
                });
                proc.on('error', (err) => {
                    pool.release(proc, model);
                    reject(err);
                });
                // Send prompt
                proc.stdin?.write(cliInput.prompt + '\n', (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        proc.stdin?.end();
                    }
                });
            });
        }, {
            maxAttempts: 3,
            initialDelay: 500,
            retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'exited with code'],
        });
        // Format response
        const response = cliResultToOpenai({
            text: result.text,
            toolCalls: result.toolCalls,
            finishReason: result.toolCalls ? 'tool_calls' : 'stop',
        }, requestId);
        // Override model name
        response.model = modelName;
        res.json(response);
    }
    catch (error) {
        logger.error('Request failed after retries', { error: error.message });
        res.status(500).json({
            error: {
                message: error.message,
                type: "server_error",
            },
        });
    }
}
/**
 * Handle GET /v1/models
 */
export function handleListModels(req, res) {
    logger.debug('List models request');
    res.json({
        object: 'list',
        data: [
            { id: 'claude-opus-4', object: 'model', created: Date.now(), owned_by: 'anthropic' },
            { id: 'claude-sonnet-4', object: 'model', created: Date.now(), owned_by: 'anthropic' },
            { id: 'claude-haiku-4', object: 'model', created: Date.now(), owned_by: 'anthropic' },
            { id: 'claude-proxy/claude-opus-4', object: 'model', created: Date.now(), owned_by: 'anthropic' },
            { id: 'claude-proxy/claude-sonnet-4', object: 'model', created: Date.now(), owned_by: 'anthropic' },
            { id: 'claude-proxy/claude-haiku-4', object: 'model', created: Date.now(), owned_by: 'anthropic' },
        ],
    });
}
/**
 * Handle GET /health
 * NEW: Shows pool statistics
 */
export function handleHealth(req, res) {
    const stats = pool.getStats();
    res.json({
        status: 'ok',
        provider: 'kit-claude-proxy',
        version: '1.1.0',
        timestamp: new Date().toISOString(),
        pool: {
            total: stats.total,
            ready: stats.ready,
            inUse: stats.inUse,
        },
        features: {
            streaming: true,
            tool_calls: true,
            system_prompts: true,
            retry_logic: true,
            process_pool: true,
        },
    });
}
//# sourceMappingURL=routes.js.map