/**
 * Standalone Server Entry Point
 *
 * NEW: Graceful shutdown handling
 * NEW: Environment-based configuration
 * NEW: Startup checks for Claude CLI
 */
import express from 'express';
import { handleChatCompletions, handleListModels, handleHealth } from './routes.js';
import { getLogger, setLogLevel } from '../utils/logger.js';
import { shutdownPool } from '../subprocess/pool.js';
import { spawn } from 'child_process';
const logger = getLogger();
const DEFAULT_CONFIG = {
    port: parseInt(process.env.PORT || '3456', 10),
    host: process.env.HOST || '127.0.0.1',
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT || '3', 10),
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT || '120000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    version: process.env.npm_package_version || '1.0.0',
};
/**
 * Check if Claude CLI is installed and authenticated
 */
async function checkClaudeCli() {
    return new Promise((resolve) => {
        const proc = spawn('claude', ['--version'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 10000,
        });
        let stdout = '';
        let stderr = '';
        proc.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        proc.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        proc.on('close', (code) => {
            if (code === 0) {
                resolve({ ok: true });
            }
            else {
                resolve({
                    ok: false,
                    error: `Claude CLI check failed (exit ${code}): ${stderr || stdout}`
                });
            }
        });
        proc.on('error', (err) => {
            resolve({ ok: false, error: `Failed to spawn Claude CLI: ${err.message}` });
        });
        // Timeout fallback
        setTimeout(() => {
            proc.kill();
            resolve({ ok: false, error: 'Claude CLI check timed out' });
        }, 10000);
    });
}
async function main() {
    // Configure logging
    setLogLevel(DEFAULT_CONFIG.logLevel);
    console.log('Kit Claude Proxy Server');
    console.log('=======================\n');
    // Check Claude CLI
    console.log('Checking Claude CLI...');
    const cliCheck = await checkClaudeCli();
    if (!cliCheck.ok) {
        console.error(`  ✗ ${cliCheck.error}`);
        console.error('\nPlease install Claude CLI and authenticate:');
        console.error('  npm install -g @anthropic-ai/claude-code');
        console.error('  claude auth login');
        process.exit(1);
    }
    console.log(`  ✓ Claude CLI detected`);
    console.log(`  ✓ Authentication: OK\n`);
    // Create Express app
    const app = express();
    // Middleware
    app.use(express.json({ limit: '10mb' }));
    // Request logging middleware
    app.use((req, _res, next) => {
        logger.debug(`${req.method} ${req.path}`);
        next();
    });
    // Health check
    app.get('/health', handleHealth);
    // OpenAI-compatible routes
    app.get('/v1/models', handleListModels);
    app.post('/v1/chat/completions', handleChatCompletions);
    // Also support routes without /v1 prefix
    app.get('/models', handleListModels);
    app.post('/chat/completions', handleChatCompletions);
    // Error handling middleware
    app.use((err, _req, res, _next) => {
        logger.error('Express error', { error: err.message, stack: err.stack });
        res.status(500).json({
            error: {
                message: err.message,
                type: 'server_error',
            },
        });
    });
    // 404 handler
    app.use((_req, res) => {
        res.status(404).json({
            error: {
                message: 'Not found',
                type: 'invalid_request_error',
                code: 'resource_not_found',
            },
        });
    });
    // Start server
    const server = app.listen(DEFAULT_CONFIG.port, DEFAULT_CONFIG.host, () => {
        console.log(`[Server] Kit Claude Proxy running at http://${DEFAULT_CONFIG.host}:${DEFAULT_CONFIG.port}`);
        console.log(`[Server] OpenAI-compatible endpoint: http://${DEFAULT_CONFIG.host}:${DEFAULT_CONFIG.port}/v1/chat/completions`);
        console.log(`\nServer ready. Test with:`);
        console.log(`  curl http://localhost:${DEFAULT_CONFIG.port}/health`);
        console.log(`  curl http://localhost:${DEFAULT_CONFIG.port}/v1/models`);
        console.log(`\nPress Ctrl+C to stop.`);
    });
    // Graceful shutdown
    const shutdown = (signal) => {
        console.log(`\n${signal} received. Shutting down gracefully...`);
        // Shutdown process pool first
        shutdownPool();
        server.close(() => {
            console.log('Server closed.');
            process.exit(0);
        });
        // Force exit after timeout
        setTimeout(() => {
            console.error('Force exit after timeout.');
            process.exit(1);
        }, 10000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
// Run main
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=standalone.js.map