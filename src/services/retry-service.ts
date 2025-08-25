import fs from 'fs';

// Load configuration from config.json
const loadRetryConfig = () => {
  try {
    const configData = fs.readFileSync('./config.json', 'utf8');
    const userConfig = JSON.parse(configData);
    
    return {
      // Default retry settings - will be overridden by config.json
      retrySettings: userConfig.retrySettings || {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        exponentialBase: 2,
        jitterRange: 1000
      },
      rateLimitSettings: userConfig.rateLimitSettings || {
        windowMs: 10000,
        maxRequestsPerWindow: 100,
        maxRequestsPerMethod: 40,
        globalLimit: 200
      },
      apiSpecificSettings: userConfig.apiRetrySettings || {
        pumpfun: { maxRetries: 3, baseDelay: 2000 },
        raydium: { maxRetries: 2, baseDelay: 1500 },
        jupiter: { maxRetries: 3, baseDelay: 1000 },
        meteora: { maxRetries: 2, baseDelay: 2000 },
        solana: { maxRetries: 5, baseDelay: 500 }
      }
    };
  } catch (error) {
    console.error('Error loading retry config, using defaults:', error);
    return {
      retrySettings: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        exponentialBase: 2,
        jitterRange: 1000
      },
      rateLimitSettings: {
        windowMs: 10000,
        maxRequestsPerWindow: 100,
        maxRequestsPerMethod: 40,
        globalLimit: 200
      },
      apiSpecificSettings: {
        pumpfun: { maxRetries: 3, baseDelay: 2000 },
        raydium: { maxRetries: 2, baseDelay: 1500 },
        jupiter: { maxRetries: 3, baseDelay: 1000 },
        meteora: { maxRetries: 2, baseDelay: 2000 },
        solana: { maxRetries: 5, baseDelay: 500 }
      }
    };
  }
};

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBase?: number;
  jitterRange?: number;
  apiName?: string;
  endpoint?: string;
  operation?: string;
}

export interface RetryAttempt {
  attempt: number;
  error: Error;
  delay: number;
  timestamp: Date;
  apiName?: string;
  endpoint?: string;
  operation?: string;
}

/**
 * Centralized rate limiter with configurable settings
 */
export class RateLimiter {
  private requestCounts: Map<string, number[]> = new Map();
  private config: any;
  
  constructor(config?: any) {
    this.config = config || loadRetryConfig().rateLimitSettings;
  }
  
  /**
   * Wait for rate limit before making a request
   * @param method - API method/endpoint identifier
   * @param apiName - API service name
   */
  async waitForRateLimit(method: string = 'general', apiName?: string): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const key = apiName ? `${apiName}:${method}` : method;
    
    // Initialize request tracking
    if (!this.requestCounts.has(key)) {
      this.requestCounts.set(key, []);
    }
    if (!this.requestCounts.has('global')) {
      this.requestCounts.set('global', []);
    }
    
    const methodRequests = this.requestCounts.get(key)!;
    const globalRequests = this.requestCounts.get('global')!;
    
    // Remove old timestamps
    const filteredMethodRequests = methodRequests.filter(time => time > windowStart);
    const filteredGlobalRequests = globalRequests.filter(time => time > windowStart);
    
    // Check method-specific rate limit
    if (filteredMethodRequests.length >= this.config.maxRequestsPerMethod) {
      const oldestRequest = Math.min(...filteredMethodRequests);
      const waitTime = this.config.windowMs - (now - oldestRequest) + 100;
      console.log(`🔄 Rate limit reached for ${key}, waiting ${Math.round(waitTime)}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Check global rate limit
    if (filteredGlobalRequests.length >= this.config.globalLimit) {
      const oldestRequest = Math.min(...filteredGlobalRequests);
      const waitTime = this.config.windowMs - (now - oldestRequest) + 100;
      console.log(`🔄 Global rate limit reached, waiting ${Math.round(waitTime)}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Record current request
    filteredMethodRequests.push(now);
    filteredGlobalRequests.push(now);
    
    this.requestCounts.set(key, filteredMethodRequests);
    this.requestCounts.set('global', filteredGlobalRequests);
  }
  
  /**
   * Get current rate limit status
   */
  getRateLimitStatus(method: string = 'general', apiName?: string): {
    requestsInWindow: number;
    globalRequestsInWindow: number;
    windowMs: number;
  } {
    const key = apiName ? `${apiName}:${method}` : method;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    const methodRequests = (this.requestCounts.get(key) || []).filter(time => time > windowStart);
    const globalRequests = (this.requestCounts.get('global') || []).filter(time => time > windowStart);
    
    return {
      requestsInWindow: methodRequests.length,
      globalRequestsInWindow: globalRequests.length,
      windowMs: this.config.windowMs
    };
  }
}

/**
 * Centralized retry service with structured logging
 */
export class RetryService {
  private config: any;
  private rateLimiter: RateLimiter;
  private retryHistory: Map<string, RetryAttempt[]> = new Map();
  
  constructor(config?: any) {
    this.config = config || loadRetryConfig();
    this.rateLimiter = new RateLimiter(this.config.rateLimitSettings);
  }
  
  /**
   * Execute operation with retry logic and rate limiting
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      apiName = 'unknown',
      endpoint = 'unknown',
      operation: operationName = 'unknown'
    } = options;
    
    // Get API-specific settings or use defaults
    const apiSettings = this.config.apiSpecificSettings[apiName] || {};
    const maxRetries = options.maxRetries ?? apiSettings.maxRetries ?? this.config.retrySettings.maxRetries;
    const baseDelay = options.baseDelay ?? apiSettings.baseDelay ?? this.config.retrySettings.baseDelay;
    const maxDelay = options.maxDelay ?? this.config.retrySettings.maxDelay;
    const exponentialBase = options.exponentialBase ?? this.config.retrySettings.exponentialBase;
    const jitterRange = options.jitterRange ?? this.config.retrySettings.jitterRange;
    
    const operationKey = `${apiName}:${endpoint}:${operationName}`;
    let lastError: Error;
    
    // Initialize retry history for this operation
    if (!this.retryHistory.has(operationKey)) {
      this.retryHistory.set(operationKey, []);
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Apply rate limiting
        await this.rateLimiter.waitForRateLimit(endpoint, apiName);
        
        // Execute operation
        const result = await operation();
        
        // Log successful retry if this wasn't the first attempt
        if (attempt > 1) {
          console.log(`✅ ${apiName} ${endpoint} ${operationName} succeeded on attempt ${attempt}`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        // Calculate delay for next attempt
        const exponentialDelay = baseDelay * Math.pow(exponentialBase, attempt - 1);
        const jitter = Math.random() * jitterRange;
        const delay = Math.min(exponentialDelay + jitter, maxDelay);
        
        // Record retry attempt
        const retryAttempt: RetryAttempt = {
          attempt,
          error: lastError,
          delay,
          timestamp: new Date(),
          apiName,
          endpoint,
          operation: operationName
        };
        
        this.retryHistory.get(operationKey)!.push(retryAttempt);
        
        // Log structured retry information
        if (attempt < maxRetries) {
          console.log(`⚠️ ${apiName} ${endpoint} ${operationName} attempt ${attempt}/${maxRetries} failed:`, {
            error: lastError.message,
            nextRetryIn: `${Math.round(delay)}ms`,
            apiName,
            endpoint,
            operation: operationName,
            timestamp: new Date().toISOString()
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Log final failure
          console.error(`❌ ${apiName} ${endpoint} ${operationName} failed after ${maxRetries} attempts:`, {
            error: lastError.message,
            totalAttempts: maxRetries,
            apiName,
            endpoint,
            operation: operationName,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    throw new Error(`${apiName} ${endpoint} ${operationName} failed after ${maxRetries} attempts. Last error: ${lastError!.message}`);
  }
  
  /**
   * Get retry statistics for monitoring
   */
  getRetryStats(): {
    totalOperations: number;
    operationsWithRetries: number;
    averageRetries: number;
    topFailingOperations: Array<{operation: string; failures: number}>;
  } {
    const operations = Array.from(this.retryHistory.keys());
    const operationsWithRetries = operations.filter(key => this.retryHistory.get(key)!.length > 0);
    
    const totalRetries = operationsWithRetries.reduce((sum, key) => 
      sum + this.retryHistory.get(key)!.length, 0
    );
    
    const topFailing = operations
      .map(key => ({
        operation: key,
        failures: this.retryHistory.get(key)!.length
      }))
      .filter(op => op.failures > 0)
      .sort((a, b) => b.failures - a.failures)
      .slice(0, 5);
    
    return {
      totalOperations: operations.length,
      operationsWithRetries: operationsWithRetries.length,
      averageRetries: operationsWithRetries.length > 0 ? totalRetries / operationsWithRetries.length : 0,
      topFailingOperations: topFailing
    };
  }
  
  /**
   * Clear retry history (useful for testing or periodic cleanup)
   */
  clearHistory(): void {
    this.retryHistory.clear();
  }
}

// Global retry service instance
export const retryService = new RetryService();