/**
 * Claude CLI Subprocess Manager
 *
 * NEW: Proper signal handling and cleanup
 * NEW: Parses structured JSON output from --output-format stream-json
 * FIX: Handles errors gracefully
 */
import { EventEmitter } from 'events';
import { ClaudeModel } from '../types/index.js';
export interface SubprocessOptions {
    model: ClaudeModel;
    sessionId?: string;
    system?: string;
}
export declare class ClaudeSubprocess extends EventEmitter {
    private process;
    private buffer;
    private resultText;
    private isKilled;
    /**
     * Start the Claude CLI subprocess
     * NEW: Uses --output-format stream-json for structured output
     */
    start(prompt: string, options: SubprocessOptions): Promise<void>;
    /**
     * Handle stdout data from CLI
     * Parses JSON stream events
     */
    private handleStdout;
    /**
     * Handle a parsed stream event
     */
    private handleStreamEvent;
    /**
     * Kill the subprocess gracefully
     * NEW: Proper cleanup
     */
    kill(): void;
    /**
     * Check if subprocess is running
     */
    isRunning(): boolean;
}
//# sourceMappingURL=manager.d.ts.map