/**
 * API Route Handlers
 *
 * Implements OpenAI-compatible endpoints
 * NEW: Better error handling with proper HTTP codes
 * NEW: Concurrency limiting
 * FIX: Proper content-type handling
 */
import { Request, Response } from 'express';
/**
 * Handle POST /v1/chat/completions
 */
export declare function handleChatCompletions(req: Request, res: Response): Promise<void>;
/**
 * Handle GET /v1/models
 * NEW: Returns proper OpenAI-compatible model list
 */
export declare function handleListModels(req: Request, res: Response): void;
/**
 * Handle GET /health
 * NEW: Enhanced health check with version info
 */
export declare function handleHealth(req: Request, res: Response): void;
//# sourceMappingURL=routes.d.ts.map