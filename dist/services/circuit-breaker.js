"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.circuitBreaker = exports.CircuitBreaker = void 0;
const fs_1 = __importDefault(require("fs"));
const config_manager_1 = require("./config-manager");
const structured_logger_1 = require("./structured-logger");
const notifications_1 = require("./notifications");
/**
 * Circuit breaker for trading operations to prevent catastrophic losses
 */
class CircuitBreaker {
    state;
    config;
    constructor() {
        this.config = config_manager_1.configManager.getConfig().circuitBreaker || {};
        this.state = this.loadState();
        // Listen for config changes
        config_manager_1.configManager.onConfigChange(() => {
            this.config = config_manager_1.configManager.getConfig().circuitBreaker || {};
            structured_logger_1.logger.info('Circuit breaker configuration updated', { config: this.config });
        });
        // Reset daily counters if needed
        this.resetDailyCountersIfNeeded();
    }
    /**
     * Check if trading is allowed
     */
    canTrade() {
        if (!this.config.enabled) {
            return { allowed: true };
        }
        // Reset daily counters if needed
        this.resetDailyCountersIfNeeded();
        // Check if circuit breaker is open
        if (this.state.isOpen) {
            if (Date.now() < this.state.nextAttemptTime) {
                return {
                    allowed: false,
                    reason: `Circuit breaker is open. Next attempt in ${Math.round((this.state.nextAttemptTime - Date.now()) / 1000)}s`
                };
            }
            else {
                // Try half-open state
                this.state.isHalfOpen = true;
                this.state.isOpen = false;
                this.saveState();
                structured_logger_1.logger.logCircuitBreakerEvent('half-open', 'Attempting recovery');
            }
        }
        // Check daily loss threshold
        if (this.config.dailyLossThreshold && this.state.dailyLoss >= this.config.dailyLossThreshold) {
            this.openCircuitBreaker(`Daily loss threshold reached: ${this.state.dailyLoss} SOL`).catch(error => {
                structured_logger_1.logger.error('Error opening circuit breaker', { error: error.message });
            });
            return { allowed: false, reason: 'Daily loss threshold exceeded' };
        }
        // Check error threshold
        if (this.config.errorThreshold && this.state.consecutiveFailures >= this.config.errorThreshold) {
            this.openCircuitBreaker(`Error threshold reached: ${this.state.consecutiveFailures} consecutive failures`).catch(error => {
                structured_logger_1.logger.error('Error opening circuit breaker', { error: error.message });
            });
            return { allowed: false, reason: 'Too many consecutive errors' };
        }
        return { allowed: true };
    }
    /**
     * Record a trade result
     */
    recordTrade(result) {
        if (!this.config.enabled)
            return;
        this.state.dailyTrades++;
        if (result.success) {
            this.recordSuccess(result);
        }
        else {
            this.recordFailure(result);
        }
        this.saveState();
    }
    /**
     * Record a successful trade
     */
    recordSuccess(result) {
        this.state.lastSuccessTime = Date.now();
        this.state.consecutiveFailures = 0;
        // Add profit/loss to daily totals
        if (result.profitLoss !== undefined) {
            if (result.profitLoss > 0) {
                // Profit reduces daily loss
                this.state.dailyLoss = Math.max(0, this.state.dailyLoss - result.profitLoss);
            }
            else {
                // Loss adds to daily loss
                this.state.dailyLoss += Math.abs(result.profitLoss);
            }
        }
        // Close circuit breaker if it was half-open
        if (this.state.isHalfOpen) {
            this.state.isHalfOpen = false;
            this.state.failureCount = 0;
            structured_logger_1.logger.logCircuitBreakerEvent('closed', 'Recovery successful');
        }
        structured_logger_1.logger.info('Trade success recorded', {
            tokenMint: result.tokenMint,
            amount: result.amount,
            profitLoss: result.profitLoss,
            dailyLoss: this.state.dailyLoss,
            dailyTrades: this.state.dailyTrades
        });
    }
    /**
     * Record a failed trade
     */
    recordFailure(result) {
        this.state.lastFailureTime = Date.now();
        this.state.failureCount++;
        this.state.consecutiveFailures++;
        // Add trade loss to daily total
        if (result.profitLoss !== undefined && result.profitLoss < 0) {
            this.state.dailyLoss += Math.abs(result.profitLoss);
        }
        else if (result.amount) {
            // If no profit/loss specified, assume full trade amount as loss
            this.state.dailyLoss += result.amount;
        }
        // Check for single loss threshold
        const singleLoss = result.profitLoss ? Math.abs(result.profitLoss) : result.amount;
        if (this.config.singleLossThreshold && singleLoss >= this.config.singleLossThreshold) {
            this.openCircuitBreaker(`Single trade loss threshold exceeded: ${singleLoss} SOL`).catch(error => {
                structured_logger_1.logger.error('Error opening circuit breaker', { error: error.message });
            });
            return;
        }
        // Check for daily loss threshold
        if (this.config.dailyLossThreshold && this.state.dailyLoss >= this.config.dailyLossThreshold) {
            this.openCircuitBreaker(`Daily loss threshold reached: ${this.state.dailyLoss} SOL`).catch(error => {
                structured_logger_1.logger.error('Error opening circuit breaker', { error: error.message });
            });
            return;
        }
        // Check error threshold
        if (this.config.errorThreshold && this.state.consecutiveFailures >= this.config.errorThreshold) {
            this.openCircuitBreaker(`Error threshold reached: ${this.state.consecutiveFailures} consecutive failures`).catch(error => {
                structured_logger_1.logger.error('Error opening circuit breaker', { error: error.message });
            });
            return;
        }
        // If half-open, return to open state
        if (this.state.isHalfOpen) {
            this.openCircuitBreaker('Recovery attempt failed').catch(error => {
                structured_logger_1.logger.error('Error opening circuit breaker', { error: error.message });
            });
        }
        structured_logger_1.logger.error('Trade failure recorded', {
            tokenMint: result.tokenMint,
            amount: result.amount,
            profitLoss: result.profitLoss,
            error: result.error,
            dailyLoss: this.state.dailyLoss,
            consecutiveFailures: this.state.consecutiveFailures,
            dailyTrades: this.state.dailyTrades
        });
    }
    /**
     * Open the circuit breaker
     */
    async openCircuitBreaker(reason) {
        this.state.isOpen = true;
        this.state.isHalfOpen = false;
        this.state.nextAttemptTime = Date.now() + (this.config.recoveryTimeMs || 300000); // 5 min default
        structured_logger_1.logger.logCircuitBreakerEvent('opened', reason);
        // Send notification
        try {
            await notifications_1.notificationService.sendNotification(`🔴 Circuit Breaker Opened: ${reason}`, 'error', {
                timestamp: new Date()
            });
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to send circuit breaker notification', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
        this.saveState();
    }
    /**
     * Reset daily counters if a new day has started
     */
    resetDailyCountersIfNeeded() {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        if (now - this.state.lastResetTime > dayMs) {
            structured_logger_1.logger.info('Resetting daily circuit breaker counters', {
                previousDailyLoss: this.state.dailyLoss,
                previousDailyTrades: this.state.dailyTrades
            });
            this.state.dailyLoss = 0;
            this.state.dailyTrades = 0;
            this.state.lastResetTime = now;
            this.saveState();
        }
    }
    /**
     * Get current circuit breaker status
     */
    getStatus() {
        return {
            enabled: this.config.enabled || false,
            isOpen: this.state.isOpen,
            isHalfOpen: this.state.isHalfOpen,
            dailyLoss: this.state.dailyLoss,
            dailyTrades: this.state.dailyTrades,
            consecutiveFailures: this.state.consecutiveFailures,
            nextAttemptTime: this.state.isOpen ? this.state.nextAttemptTime : undefined,
            thresholds: {
                dailyLossThreshold: this.config.dailyLossThreshold,
                singleLossThreshold: this.config.singleLossThreshold,
                errorThreshold: this.config.errorThreshold
            }
        };
    }
    /**
     * Manually reset the circuit breaker (for testing/emergency)
     */
    reset() {
        structured_logger_1.logger.warn('Circuit breaker manually reset');
        this.state = {
            isOpen: false,
            isHalfOpen: false,
            failureCount: 0,
            lastFailureTime: 0,
            lastSuccessTime: 0,
            nextAttemptTime: 0,
            dailyLoss: 0,
            dailyTrades: 0,
            lastResetTime: Date.now(),
            consecutiveFailures: 0
        };
        this.saveState();
    }
    /**
     * Load circuit breaker state from file
     */
    loadState() {
        try {
            const stateFile = this.config.stateFile || './circuit-breaker-state.json';
            if (fs_1.default.existsSync(stateFile)) {
                const data = fs_1.default.readFileSync(stateFile, 'utf8');
                const loadedState = JSON.parse(data);
                // Validate and merge with defaults
                return {
                    isOpen: loadedState.isOpen || false,
                    isHalfOpen: loadedState.isHalfOpen || false,
                    failureCount: loadedState.failureCount || 0,
                    lastFailureTime: loadedState.lastFailureTime || 0,
                    lastSuccessTime: loadedState.lastSuccessTime || 0,
                    nextAttemptTime: loadedState.nextAttemptTime || 0,
                    dailyLoss: loadedState.dailyLoss || 0,
                    dailyTrades: loadedState.dailyTrades || 0,
                    lastResetTime: loadedState.lastResetTime || Date.now(),
                    consecutiveFailures: loadedState.consecutiveFailures || 0
                };
            }
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to load circuit breaker state', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
        // Return default state
        return {
            isOpen: false,
            isHalfOpen: false,
            failureCount: 0,
            lastFailureTime: 0,
            lastSuccessTime: 0,
            nextAttemptTime: 0,
            dailyLoss: 0,
            dailyTrades: 0,
            lastResetTime: Date.now(),
            consecutiveFailures: 0
        };
    }
    /**
     * Save circuit breaker state to file
     */
    saveState() {
        try {
            const stateFile = this.config.stateFile || './circuit-breaker-state.json';
            fs_1.default.writeFileSync(stateFile, JSON.stringify(this.state, null, 2));
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to save circuit breaker state', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    /**
     * Cleanup resources
     */
    destroy() {
        this.saveState();
    }
}
exports.CircuitBreaker = CircuitBreaker;
// Global circuit breaker instance
exports.circuitBreaker = new CircuitBreaker();
