/**
 * API Route Handlers - Improved Version with Process Pool & Retry
 *
 * Implements OpenAI-compatible endpoints with:
 * - Pre-warmed process pool for faster responses
 * - Robust retry logic with exponential backoff
 * - Full tool use support
 * - Improved error handling
 */
import { Request, Response } from 'express';
/**
 * Handle POST /v1/chat/completions
 * NEW: Uses process pool and retry logic
 */
export declare function handleChatCompletions(req: Request, res: Response): Promise<void>;
/**
 * Handle GET /v1/models
 */
export declare function handleListModels(req: Request, res: Response): void;
/**
 * Handle GET /health
 * NEW: Shows pool statistics
 */
export declare function handleHealth(req: Request, res: Response): void;
//# sourceMappingURL=routes.d.ts.map