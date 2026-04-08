/**
 * Structured logging utility with configurable levels
 */
import { Logger, LogLevel } from '../types/index.js';
declare class ConsoleLogger implements Logger {
    private level;
    constructor(level?: LogLevel);
    private shouldLog;
    private formatMessage;
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
}
export declare function setLogLevel(level: LogLevel): void;
export declare function getLogger(): Logger;
export { ConsoleLogger };
//# sourceMappingURL=logger.d.ts.map