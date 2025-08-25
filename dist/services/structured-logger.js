"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.StructuredLogger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_manager_1 = require("./config-manager");
/**
 * Structured logging service with file output and context support
 */
class StructuredLogger {
    logFilePath = '';
    maxFileSize = 10 * 1024 * 1024; // 10MB default
    logLevel = 'info';
    structured = true;
    includeTimestamp = true;
    includeContext = true;
    constructor() {
        this.updateConfig();
        this.ensureLogDirectory();
        // Listen for config changes
        config_manager_1.configManager.onConfigChange(() => {
            this.updateConfig();
        });
    }
    updateConfig() {
        const config = config_manager_1.configManager.getConfig();
        const loggingConfig = config.logging || {};
        this.logLevel = loggingConfig.level || 'info';
        this.structured = loggingConfig.structured !== false;
        this.includeTimestamp = loggingConfig.includeTimestamp !== false;
        this.includeContext = loggingConfig.includeContext !== false;
        this.maxFileSize = this.parseFileSize(loggingConfig.maxFileSize || '10MB');
        // Set log file path
        const baseDir = './logs';
        const filename = `bot-${new Date().toISOString().split('T')[0]}.log`;
        this.logFilePath = path_1.default.join(baseDir, filename);
    }
    ensureLogDirectory() {
        const logDir = path_1.default.dirname(this.logFilePath);
        if (!fs_1.default.existsSync(logDir)) {
            fs_1.default.mkdirSync(logDir, { recursive: true });
        }
    }
    parseFileSize(sizeStr) {
        const match = sizeStr.match(/^(\d+)(MB|KB|GB)?$/i);
        if (!match)
            return 10 * 1024 * 1024; // Default 10MB
        const size = parseInt(match[1]);
        const unit = (match[2] || 'MB').toUpperCase();
        switch (unit) {
            case 'KB': return size * 1024;
            case 'GB': return size * 1024 * 1024 * 1024;
            case 'MB':
            default: return size * 1024 * 1024;
        }
    }
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentIndex = levels.indexOf(this.logLevel);
        const messageIndex = levels.indexOf(level);
        return messageIndex >= currentIndex;
    }
    formatLogEntry(entry) {
        if (this.structured) {
            return JSON.stringify({
                level: entry.level.toUpperCase(),
                message: entry.message,
                ...(this.includeTimestamp && { timestamp: entry.timestamp.toISOString() }),
                ...(this.includeContext && entry.context && { context: entry.context })
            });
        }
        else {
            let output = '';
            if (this.includeTimestamp) {
                output += `[${entry.timestamp.toISOString()}] `;
            }
            output += `${entry.level.toUpperCase()}: ${entry.message}`;
            if (this.includeContext && entry.context) {
                output += ` ${JSON.stringify(entry.context)}`;
            }
            return output;
        }
    }
    async writeToFile(entry) {
        try {
            // Check file size and rotate if necessary
            if (fs_1.default.existsSync(this.logFilePath)) {
                const stats = fs_1.default.statSync(this.logFilePath);
                if (stats.size >= this.maxFileSize) {
                    await this.rotateLogFile();
                }
            }
            const logLine = this.formatLogEntry(entry) + '\n';
            fs_1.default.appendFileSync(this.logFilePath, logLine, 'utf8');
        }
        catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }
    async rotateLogFile() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const archivePath = this.logFilePath.replace('.log', `-${timestamp}.log`);
            fs_1.default.renameSync(this.logFilePath, archivePath);
            // Clean up old log files (keep last 10)
            this.cleanupOldLogs();
        }
        catch (error) {
            console.error('Failed to rotate log file:', error);
        }
    }
    cleanupOldLogs() {
        try {
            const logDir = path_1.default.dirname(this.logFilePath);
            const files = fs_1.default.readdirSync(logDir)
                .filter(file => file.startsWith('bot-') && file.endsWith('.log'))
                .map(file => ({
                name: file,
                path: path_1.default.join(logDir, file),
                mtime: fs_1.default.statSync(path_1.default.join(logDir, file)).mtime
            }))
                .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
            // Keep only the 10 most recent log files
            const filesToDelete = files.slice(10);
            for (const file of filesToDelete) {
                fs_1.default.unlinkSync(file.path);
            }
        }
        catch (error) {
            console.error('Failed to cleanup old log files:', error);
        }
    }
    log(level, message, context) {
        if (!this.shouldLog(level))
            return;
        const entry = {
            level,
            message,
            timestamp: new Date(),
            context
        };
        // Console output
        const consoleLine = this.formatLogEntry(entry);
        switch (level) {
            case 'error':
                console.error(consoleLine);
                break;
            case 'warn':
                console.warn(consoleLine);
                break;
            case 'debug':
                console.debug(consoleLine);
                break;
            default:
                console.log(consoleLine);
        }
        // File output
        const config = config_manager_1.configManager.getConfig();
        if (config.logging?.saveToFile !== false) {
            this.writeToFile(entry);
        }
    }
    /**
     * Log debug message
     */
    debug(message, context) {
        this.log('debug', message, context);
    }
    /**
     * Log info message
     */
    info(message, context) {
        this.log('info', message, context);
    }
    /**
     * Log warning message
     */
    warn(message, context) {
        this.log('warn', message, context);
    }
    /**
     * Log error message
     */
    error(message, context) {
        this.log('error', message, context);
    }
    /**
     * Log retry attempt
     */
    logRetryAttempt(apiName, endpoint, operation, attempt, totalAttempts, error, nextDelay) {
        this.warn(`${apiName} ${endpoint} ${operation} attempt ${attempt}/${totalAttempts} failed`, {
            apiName,
            endpoint,
            operation,
            attempt,
            totalAttempts,
            error: error.message,
            nextRetryIn: nextDelay ? `${Math.round(nextDelay)}ms` : undefined
        });
    }
    /**
     * Log API success
     */
    logApiSuccess(apiName, endpoint, operation, responseTime, context) {
        this.info(`${apiName} ${endpoint} ${operation} succeeded`, {
            apiName,
            endpoint,
            operation,
            responseTimeMs: responseTime,
            ...context
        });
    }
    /**
     * Log API failure
     */
    logApiFailure(apiName, endpoint, operation, error, statusCode, context) {
        this.error(`${apiName} ${endpoint} ${operation} failed`, {
            apiName,
            endpoint,
            operation,
            error: error.message,
            statusCode,
            ...context
        });
    }
    /**
     * Log transaction details
     */
    logTransaction(type, tokenMint, amount, txHash, success = true, context) {
        const message = `${type.toUpperCase()} ${tokenMint} amount=${amount} ${success ? 'SUCCESS' : 'FAILED'}`;
        if (success) {
            this.info(message, {
                type,
                tokenMint,
                amount,
                txHash,
                ...context
            });
        }
        else {
            this.error(message, {
                type,
                tokenMint,
                amount,
                txHash,
                ...context
            });
        }
    }
    /**
     * Log circuit breaker events
     */
    logCircuitBreakerEvent(event, reason, context) {
        const message = `Circuit breaker ${event.toUpperCase()}: ${reason}`;
        if (event === 'opened') {
            this.error(message, { circuitBreaker: event, reason, ...context });
        }
        else {
            this.warn(message, { circuitBreaker: event, reason, ...context });
        }
    }
    /**
     * Log performance metrics
     */
    logPerformance(operation, duration, success, context) {
        this.info(`Performance: ${operation} completed in ${duration}ms`, {
            operation,
            duration,
            success,
            ...context
        });
    }
    /**
     * Get log statistics
     */
    getLogStats() {
        try {
            if (!fs_1.default.existsSync(this.logFilePath)) {
                return { totalEntries: 0, errorCount: 0, warnCount: 0 };
            }
            const content = fs_1.default.readFileSync(this.logFilePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            let errorCount = 0;
            let warnCount = 0;
            for (const line of lines) {
                if (line.includes('"level":"ERROR"') || line.includes('ERROR:')) {
                    errorCount++;
                }
                else if (line.includes('"level":"WARN"') || line.includes('WARN:')) {
                    warnCount++;
                }
            }
            return {
                totalEntries: lines.length,
                errorCount,
                warnCount
            };
        }
        catch (error) {
            return { totalEntries: 0, errorCount: 0, warnCount: 0 };
        }
    }
}
exports.StructuredLogger = StructuredLogger;
// Global logger instance
exports.logger = new StructuredLogger();
