"use strict";
/**
 * Rate Limiter Service for Solana RPC API calls
 *
 * This service implements Chainstack's public node limits:
 * - Maximum 100 HTTP requests per 10 seconds (all methods combined)
 * - Maximum 40 calls to the same RPC method per 10 seconds
 * - Maximum 40 simultaneous connections
 *
 * The rate limiter uses a sliding window approach to track requests and
 * automatically delays requests when limits are reached to prevent
 * API rate limit violations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = exports.RateLimiter = void 0;
/**
 * Rate limiter for Solana RPC API calls according to Chainstack limits
 *
 * Features:
 * - Per-method rate limiting (40 calls per method per 10 seconds)
 * - Global rate limiting (100 calls total per 10 seconds)
 * - Connection pooling (max 40 simultaneous connections)
 * - Automatic request queuing and delay when limits are reached
 * - Memory-efficient sliding window implementation
 */
class RateLimiter {
    requestCounts = new Map();
    activeConnections = 0;
    connectionQueue = [];
    // Chainstack public node limits
    windowMs = 10000; // 10 seconds
    maxRequestsPerWindow = 100; // Max 100 HTTP requests per 10 seconds
    maxRequestsPerMethod = 40; // Max 40 calls to same RPC method per 10 seconds
    maxSimultaneousConnections = 40; // Max 40 simultaneous connections
    /**
     * Wait for rate limit compliance before making an RPC call
     * @param method The RPC method name (e.g. 'getAccountInfo', 'getBalance', etc.)
     */
    async waitForRateLimit(method = 'general') {
        // First wait for connection availability
        await this.waitForConnectionSlot();
        const now = Date.now();
        const windowStart = now - this.windowMs;
        // Initialize method tracking if not exists
        if (!this.requestCounts.has(method)) {
            this.requestCounts.set(method, []);
        }
        if (!this.requestCounts.has('general')) {
            this.requestCounts.set('general', []);
        }
        const methodRequests = this.requestCounts.get(method);
        const generalRequests = this.requestCounts.get('general');
        // Remove old timestamps (sliding window cleanup)
        const filteredMethodRequests = methodRequests.filter(time => time > windowStart);
        const filteredGeneralRequests = generalRequests.filter(time => time > windowStart);
        // Check method-specific rate limit (40 calls per method per 10 seconds)
        if (filteredMethodRequests.length >= this.maxRequestsPerMethod) {
            const oldestRequest = Math.min(...filteredMethodRequests);
            const waitTime = this.windowMs - (now - oldestRequest) + 100; // Add 100ms buffer
            console.log(`⏳ Method rate limit reached for ${method}, waiting ${Math.round(waitTime)}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        // Check general rate limit (100 requests total per 10 seconds)
        if (filteredGeneralRequests.length >= this.maxRequestsPerWindow) {
            const oldestRequest = Math.min(...filteredGeneralRequests);
            const waitTime = this.windowMs - (now - oldestRequest) + 100; // Add 100ms buffer
            console.log(`⏳ General rate limit reached, waiting ${Math.round(waitTime)}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        // Add current request to tracking
        const currentTime = Date.now();
        filteredMethodRequests.push(currentTime);
        filteredGeneralRequests.push(currentTime);
        this.requestCounts.set(method, filteredMethodRequests);
        this.requestCounts.set('general', filteredGeneralRequests);
        // Reserve a connection slot
        this.activeConnections++;
    }
    /**
     * Wait for an available connection slot (max 40 simultaneous connections)
     */
    async waitForConnectionSlot() {
        if (this.activeConnections < this.maxSimultaneousConnections) {
            return;
        }
        console.log(`⏳ Connection limit reached (${this.activeConnections}/${this.maxSimultaneousConnections}), queuing request...`);
        return new Promise((resolve) => {
            this.connectionQueue.push(resolve);
        });
    }
    /**
     * Release a connection slot when RPC call is complete
     * Must be called after each RPC request completes
     */
    releaseConnection() {
        if (this.activeConnections > 0) {
            this.activeConnections--;
        }
        // Process next request in queue if any
        if (this.connectionQueue.length > 0) {
            const nextRequest = this.connectionQueue.shift();
            if (nextRequest) {
                nextRequest();
            }
        }
    }
    /**
     * Execute a Connection method with automatic rate limiting and connection management
     * @param connection The Solana connection instance
     * @param method The method name for rate limiting tracking
     * @param operation The connection operation to execute
     * @returns Promise resolving to the operation result
     */
    async executeRpcCall(connection, method, operation) {
        await this.waitForRateLimit(method);
        try {
            const result = await operation();
            this.releaseConnection();
            return result;
        }
        catch (error) {
            this.releaseConnection();
            throw error;
        }
    }
    /**
     * Get current rate limiter statistics for monitoring
     */
    getStats() {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        const recentRequests = {};
        for (const [method, timestamps] of this.requestCounts.entries()) {
            const recentCount = timestamps.filter(time => time > windowStart).length;
            if (recentCount > 0) {
                recentRequests[method] = recentCount;
            }
        }
        return {
            activeConnections: this.activeConnections,
            queuedRequests: this.connectionQueue.length,
            recentRequests
        };
    }
    /**
     * Clean up old request timestamps to prevent memory leaks
     * Should be called periodically
     */
    cleanup() {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        for (const [method, timestamps] of this.requestCounts.entries()) {
            const filtered = timestamps.filter(time => time > windowStart);
            this.requestCounts.set(method, filtered);
        }
        // Remove empty entries
        for (const [method, timestamps] of this.requestCounts.entries()) {
            if (timestamps.length === 0) {
                this.requestCounts.delete(method);
            }
        }
    }
}
exports.RateLimiter = RateLimiter;
// Export singleton instance for use across the application
exports.rateLimiter = new RateLimiter();
// Cleanup old request timestamps every 30 seconds to prevent memory leaks
setInterval(() => {
    exports.rateLimiter.cleanup();
}, 30000);
