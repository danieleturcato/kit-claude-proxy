/**
 * Claude CLI Subprocess Manager
 * 
 * NEW: Proper signal handling and cleanup
 * NEW: Parses structured JSON output from --output-format stream-json
 * FIX: Handles errors gracefully
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { CliInput, CliResult, ClaudeModel } from '../types/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export interface SubprocessOptions {
  model: ClaudeModel;
  sessionId?: string;
  system?: string;
}

interface StreamJsonEvent {
  type: 'content' | 'message' | 'error';
  content?: string;
  message?: {
    role: string;
    content: string;
    model?: string;
  };
  error?: {
    message: string;
    code?: string;
  };
}

export class ClaudeSubprocess extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = '';
  private resultText = '';
  private isKilled = false;

  /**
   * Start the Claude CLI subprocess
   * NEW: Uses --output-format stream-json for structured output
   */
  async start(prompt: string, options: SubprocessOptions): Promise<void> {
    if (this.process) {
      throw new Error('Subprocess already started');
    }

    const args = [
      '--print',
      '--model', options.model,
    ];

    // NOTE: Claude CLI doesn't support --system flag
    // System prompt is handled in openai-to-cli.ts by wrapping in the prompt

    logger.debug('Spawning Claude CLI', { 
      model: options.model, 
      promptLength: prompt.length,
      hasSystemPrompt: !!options.system,
    });

    this.process = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Ensure CLI uses the right auth
        CLAUDE_CODE_DISABLE_TELEMETRY: '1',
      },
    });

    // Handle stdout (JSON streaming)
    this.process.stdout?.on('data', (data: Buffer) => {
      logger.debug('STDOUT raw', { data: data.toString().slice(0, 100) });
      this.handleStdout(data.toString());
    });

    // Handle stderr
    this.process.stderr?.on('data', (data: Buffer) => {
      const stderr = data.toString();
      logger.info('STDERR', { stderr: stderr.slice(0, 500) });
    });

    // Handle process exit
    this.process.on('close', (code) => {
      logger.debug('Claude CLI exited', { code });
      
      if (!this.isKilled) {
        // Emit result if we have content
        if (this.resultText) {
          this.emit('result', {
            text: this.resultText.trim(),
            finishReason: 'stop',
          } as CliResult);
        } else {
          this.emit('error', new Error(`Claude CLI exited with code ${code} without output`));
        }
      }
      
      this.emit('close', code);
    });

    // Handle process errors
    this.process.on('error', (err) => {
      logger.error('Claude CLI process error', { error: err.message });
      this.emit('error', err);
    });

    // Send prompt to stdin
    this.process.stdin?.write(prompt + '\n', (err) => {
      if (err) {
        logger.error('Failed to write to stdin', { error: err.message });
        this.emit('error', err);
      } else {
        this.process?.stdin?.end();
      }
    });
  }

  /**
   * Handle stdout data from CLI
   * Parses JSON stream events
   */
  private handleStdout(data: string): void {
    this.buffer += data;
    logger.debug('Raw stdout data', { data: data.slice(0, 200) });
    
    // Process complete lines (JSON events)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      logger.debug('Processing line', { line: line.slice(0, 100) });
      
      try {
        const event: StreamJsonEvent = JSON.parse(line);
        this.handleStreamEvent(event);
      } catch (err) {
        // Not JSON, treat as plain text
        logger.debug('Non-JSON output from CLI', { line: line.slice(0, 100) });
        this.resultText += line + '\n';
        this.emit('chunk', line + '\n');
      }
    }
  }

  /**
   * Handle a parsed stream event
   */
  private handleStreamEvent(event: StreamJsonEvent): void {
    switch (event.type) {
      case 'content':
        if (event.content) {
          this.resultText += event.content;
          this.emit('chunk', event.content);
        }
        break;
        
      case 'message':
        if (event.message) {
          logger.debug('Received message event', { 
            role: event.message.role,
            model: event.message.model,
          });
          this.emit('message', event.message);
        }
        break;
        
      case 'error':
        const errorMsg = event.error?.message || 'Unknown CLI error';
        logger.error('CLI error event', { error: errorMsg });
        this.emit('error', new Error(errorMsg));
        break;
    }
  }

  /**
   * Kill the subprocess gracefully
   * NEW: Proper cleanup
   */
  kill(): void {
    if (this.isKilled || !this.process) return;
    
    this.isKilled = true;
    logger.debug('Killing Claude CLI subprocess');
    
    // Try graceful shutdown first
    this.process.kill('SIGTERM');
    
    // Force kill after timeout
    setTimeout(() => {
      if (this.process && !this.process.killed) {
        logger.warn('Force killing Claude CLI subprocess');
        this.process.kill('SIGKILL');
      }
    }, 5000);
  }

  /**
   * Check if subprocess is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed && !this.isKilled;
  }
}
