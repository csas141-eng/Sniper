import fs from 'fs';
import path from 'path';
import { configManager } from './config-manager';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  apiName?: string;
  endpoint?: string;
  operation?: string;
  txHash?: string;
  tokenMint?: string;
  attempt?: number;
  totalAttempts?: number;
  delay?: number;
  error?: string;
  statusCode?: number;
  responseTime?: number;
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: LogContext;
}

/**
 * Structured logging service with file output and context support
 */
export class StructuredLogger {
  private logFilePath: string = '';
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB default
  private logLevel: LogLevel = 'info';
  private structured: boolean = true;
  private includeTimestamp: boolean = true;
  private includeContext: boolean = true;

  constructor() {
    this.updateConfig();
    this.ensureLogDirectory();
    
    // Listen for config changes
    configManager.onConfigChange(() => {
      this.updateConfig();
    });
  }

  private updateConfig(): void {
    const config = configManager.getConfig();
    const loggingConfig = config.logging || {};
    
    this.logLevel = loggingConfig.level || 'info';
    this.structured = loggingConfig.structured !== false;
    this.includeTimestamp = loggingConfig.includeTimestamp !== false;
    this.includeContext = loggingConfig.includeContext !== false;
    this.maxFileSize = this.parseFileSize(loggingConfig.maxFileSize || '10MB');
    
    // Set log file path
    const baseDir = './logs';
    const filename = `bot-${new Date().toISOString().split('T')[0]}.log`;
    this.logFilePath = path.join(baseDir, filename);
  }

  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private parseFileSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+)(MB|KB|GB)?$/i);
    if (!match) return 10 * 1024 * 1024; // Default 10MB
    
    const size = parseInt(match[1]);
    const unit = (match[2] || 'MB').toUpperCase();
    
    switch (unit) {
      case 'KB': return size * 1024;
      case 'GB': return size * 1024 * 1024 * 1024;
      case 'MB':
      default: return size * 1024 * 1024;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  private formatLogEntry(entry: LogEntry): string {
    if (this.structured) {
      return JSON.stringify({
        level: entry.level.toUpperCase(),
        message: entry.message,
        ...(this.includeTimestamp && { timestamp: entry.timestamp.toISOString() }),
        ...(this.includeContext && entry.context && { context: entry.context })
      });
    } else {
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

  private async writeToFile(entry: LogEntry): Promise<void> {
    try {
      // Check file size and rotate if necessary
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);
        if (stats.size >= this.maxFileSize) {
          await this.rotateLogFile();
        }
      }

      const logLine = this.formatLogEntry(entry) + '\n';
      fs.appendFileSync(this.logFilePath, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private async rotateLogFile(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivePath = this.logFilePath.replace('.log', `-${timestamp}.log`);
      fs.renameSync(this.logFilePath, archivePath);
      
      // Clean up old log files (keep last 10)
      this.cleanupOldLogs();
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  private cleanupOldLogs(): void {
    try {
      const logDir = path.dirname(this.logFilePath);
      const files = fs.readdirSync(logDir)
        .filter(file => file.startsWith('bot-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          mtime: fs.statSync(path.join(logDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the 10 most recent log files
      const filesToDelete = files.slice(10);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
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
    const config = configManager.getConfig();
    if (config.logging?.saveToFile !== false) {
      this.writeToFile(entry);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  /**
   * Log retry attempt
   */
  logRetryAttempt(
    apiName: string,
    endpoint: string,
    operation: string,
    attempt: number,
    totalAttempts: number,
    error: Error,
    nextDelay?: number
  ): void {
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
  logApiSuccess(
    apiName: string,
    endpoint: string,
    operation: string,
    responseTime?: number,
    context?: LogContext
  ): void {
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
  logApiFailure(
    apiName: string,
    endpoint: string,
    operation: string,
    error: Error,
    statusCode?: number,
    context?: LogContext
  ): void {
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
  logTransaction(
    type: 'buy' | 'sell',
    tokenMint: string,
    amount: number,
    txHash?: string,
    success: boolean = true,
    context?: LogContext
  ): void {
    const message = `${type.toUpperCase()} ${tokenMint} amount=${amount} ${success ? 'SUCCESS' : 'FAILED'}`;
    
    if (success) {
      this.info(message, {
        type,
        tokenMint,
        amount,
        txHash,
        ...context
      });
    } else {
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
  logCircuitBreakerEvent(
    event: 'opened' | 'closed' | 'half-open',
    reason: string,
    context?: LogContext
  ): void {
    const message = `Circuit breaker ${event.toUpperCase()}: ${reason}`;
    
    if (event === 'opened') {
      this.error(message, { circuitBreaker: event, reason, ...context });
    } else {
      this.warn(message, { circuitBreaker: event, reason, ...context });
    }
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    operation: string,
    duration: number,
    success: boolean,
    context?: LogContext
  ): void {
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
  getLogStats(): { totalEntries: number; errorCount: number; warnCount: number } {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        return { totalEntries: 0, errorCount: 0, warnCount: 0 };
      }

      const content = fs.readFileSync(this.logFilePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      let errorCount = 0;
      let warnCount = 0;
      
      for (const line of lines) {
        if (line.includes('"level":"ERROR"') || line.includes('ERROR:')) {
          errorCount++;
        } else if (line.includes('"level":"WARN"') || line.includes('WARN:')) {
          warnCount++;
        }
      }
      
      return {
        totalEntries: lines.length,
        errorCount,
        warnCount
      };
    } catch (error) {
      return { totalEntries: 0, errorCount: 0, warnCount: 0 };
    }
  }
}

// Global logger instance
export const logger = new StructuredLogger();