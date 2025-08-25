"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.statePersistence = exports.StatePersistence = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_manager_1 = require("./config-manager");
const structured_logger_1 = require("./structured-logger");
/**
 * State persistence service for crash recovery
 */
class StatePersistence {
    config;
    state;
    saveTimer;
    constructor() {
        this.config = config_manager_1.configManager.getConfig().statePersistence || {};
        this.state = this.loadState();
        // Start auto-save if enabled
        if (this.config.enabled !== false) {
            this.startAutoSave();
        }
        // Listen for config changes
        config_manager_1.configManager.onConfigChange(() => {
            this.config = config_manager_1.configManager.getConfig().statePersistence || {};
            if (this.config.enabled !== false && !this.saveTimer) {
                this.startAutoSave();
            }
            else if (this.config.enabled === false && this.saveTimer) {
                this.stopAutoSave();
            }
        });
        // Set up graceful shutdown handlers
        process.on('SIGINT', () => this.saveState());
        process.on('SIGTERM', () => this.saveState());
        process.on('exit', () => this.saveState());
    }
    /**
     * Get current bot state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Update active snipes
     */
    updateActiveSnipes(snipes) {
        this.state.activeSnipes = snipes;
        this.state.timestamp = Date.now();
    }
    /**
     * Add a new active snipe
     */
    addActiveSnipe(snipe) {
        this.state.activeSnipes.push(snipe);
        this.state.timestamp = Date.now();
        structured_logger_1.logger.info('Added active snipe to state', {
            tokenMint: snipe.tokenMint,
            platform: snipe.platform,
            totalActive: this.state.activeSnipes.length
        });
    }
    /**
     * Update snipe status
     */
    updateSnipeStatus(tokenMint, status, txHash, error) {
        const snipe = this.state.activeSnipes.find(s => s.tokenMint === tokenMint);
        if (snipe) {
            snipe.status = status;
            if (txHash)
                snipe.txHash = txHash;
            if (error)
                snipe.error = error;
            this.state.timestamp = Date.now();
            structured_logger_1.logger.info('Updated snipe status', {
                tokenMint,
                status,
                txHash,
                error: error ? error.substring(0, 100) : undefined
            });
            // Remove completed/failed snipes after some time
            if ((status === 'completed' || status === 'failed')) {
                setTimeout(() => {
                    this.removeActiveSnipe(tokenMint);
                }, 60000); // Remove after 1 minute
            }
        }
    }
    /**
     * Remove active snipe
     */
    removeActiveSnipe(tokenMint) {
        const index = this.state.activeSnipes.findIndex(s => s.tokenMint === tokenMint);
        if (index > -1) {
            this.state.activeSnipes.splice(index, 1);
            this.state.timestamp = Date.now();
            structured_logger_1.logger.info('Removed active snipe from state', { tokenMint, remainingActive: this.state.activeSnipes.length });
        }
    }
    /**
     * Update error counters
     */
    recordError(errorType, apiName, error) {
        this.state.errorCounters.totalErrors++;
        this.state.errorCounters.consecutiveErrors++;
        this.state.errorCounters.lastErrorTime = Date.now();
        // Track by error type
        if (!this.state.errorCounters.errorsByType[errorType]) {
            this.state.errorCounters.errorsByType[errorType] = 0;
        }
        this.state.errorCounters.errorsByType[errorType]++;
        // Track by API
        if (apiName) {
            if (!this.state.errorCounters.errorsByApi[apiName]) {
                this.state.errorCounters.errorsByApi[apiName] = 0;
            }
            this.state.errorCounters.errorsByApi[apiName]++;
        }
        this.state.timestamp = Date.now();
        structured_logger_1.logger.error('Error recorded in state', {
            errorType,
            apiName,
            totalErrors: this.state.errorCounters.totalErrors,
            consecutiveErrors: this.state.errorCounters.consecutiveErrors,
            error: error?.message
        });
    }
    /**
     * Reset consecutive error counter on success
     */
    recordSuccess() {
        if (this.state.errorCounters.consecutiveErrors > 0) {
            structured_logger_1.logger.info('Resetting consecutive error counter', {
                previousConsecutiveErrors: this.state.errorCounters.consecutiveErrors
            });
            this.state.errorCounters.consecutiveErrors = 0;
            this.state.timestamp = Date.now();
        }
    }
    /**
     * Update pools cache
     */
    updatePoolsCache(pools) {
        this.state.poolsCache = pools;
        this.state.timestamp = Date.now();
        structured_logger_1.logger.debug('Updated pools cache', { poolCount: pools.length });
    }
    /**
     * Add pool to cache
     */
    addPoolToCache(pool) {
        // Remove existing entry for same mint
        this.state.poolsCache = this.state.poolsCache.filter(p => p.mint !== pool.mint);
        // Add new entry
        this.state.poolsCache.push(pool);
        // Keep only recent pools (last 1000)
        if (this.state.poolsCache.length > 1000) {
            this.state.poolsCache = this.state.poolsCache
                .sort((a, b) => b.discoveredAt - a.discoveredAt)
                .slice(0, 1000);
        }
        this.state.timestamp = Date.now();
        structured_logger_1.logger.debug('Added pool to cache', {
            mint: pool.mint,
            platform: pool.platform,
            totalPools: this.state.poolsCache.length
        });
    }
    /**
     * Update profit statistics
     */
    updateProfitStats(stats) {
        this.state.profitStats = { ...this.state.profitStats, ...stats };
        this.state.timestamp = Date.now();
    }
    /**
     * Record a trade result
     */
    recordTrade(success, profit, tradeSize) {
        this.state.profitStats.totalTrades++;
        if (success) {
            this.state.profitStats.successfulTrades++;
            this.state.profitStats.totalProfit += Math.max(0, profit);
            if (profit > this.state.profitStats.bestTrade) {
                this.state.profitStats.bestTrade = profit;
            }
        }
        else {
            this.state.profitStats.totalLoss += Math.max(0, Math.abs(profit));
            if (profit < this.state.profitStats.worstTrade) {
                this.state.profitStats.worstTrade = profit;
            }
        }
        // Update average trade size
        this.state.profitStats.avgTradeSize =
            ((this.state.profitStats.avgTradeSize * (this.state.profitStats.totalTrades - 1)) + tradeSize)
                / this.state.profitStats.totalTrades;
        this.state.timestamp = Date.now();
        structured_logger_1.logger.info('Trade recorded in stats', {
            success,
            profit,
            tradeSize,
            totalTrades: this.state.profitStats.totalTrades,
            successRate: this.state.profitStats.successfulTrades / this.state.profitStats.totalTrades
        });
    }
    /**
     * Update runtime statistics
     */
    updateRuntimeStats() {
        this.state.runtimeStats.uptime = Date.now() - this.state.runtimeStats.startTime;
        this.state.runtimeStats.lastHealthCheck = Date.now();
        this.state.runtimeStats.memoryUsage = process.memoryUsage();
        this.state.timestamp = Date.now();
    }
    /**
     * Update WebSocket connection status
     */
    updateWSConnection(name, connected) {
        this.state.runtimeStats.wsConnections[name] = connected;
        this.state.timestamp = Date.now();
        structured_logger_1.logger.info('WebSocket connection status updated', { name, connected });
    }
    /**
     * Record config reload
     */
    recordConfigReload() {
        this.state.runtimeStats.configReloads++;
        this.state.timestamp = Date.now();
        structured_logger_1.logger.info('Config reload recorded', { totalReloads: this.state.runtimeStats.configReloads });
    }
    /**
     * Start auto-save timer
     */
    startAutoSave() {
        const interval = this.config.saveIntervalMs || 30000; // 30 seconds default
        this.saveTimer = setInterval(() => {
            this.saveState();
        }, interval);
        structured_logger_1.logger.info('State persistence auto-save started', { intervalMs: interval });
    }
    /**
     * Stop auto-save timer
     */
    stopAutoSave() {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
            this.saveTimer = undefined;
            structured_logger_1.logger.info('State persistence auto-save stopped');
        }
    }
    /**
     * Save state to file
     */
    saveState() {
        if (this.config.enabled === false)
            return;
        try {
            const stateFile = this.config.stateFile || './bot-state.json';
            const stateDir = path_1.default.dirname(stateFile);
            // Ensure directory exists
            if (!fs_1.default.existsSync(stateDir)) {
                fs_1.default.mkdirSync(stateDir, { recursive: true });
            }
            // Create backup if file exists
            if (fs_1.default.existsSync(stateFile)) {
                this.createBackup(stateFile);
            }
            // Update timestamp
            this.state.timestamp = Date.now();
            // Write state
            fs_1.default.writeFileSync(stateFile, JSON.stringify(this.state, null, 2));
            structured_logger_1.logger.debug('Bot state saved successfully', {
                activeSnipes: this.state.activeSnipes.length,
                poolsCached: this.state.poolsCache.length,
                totalTrades: this.state.profitStats.totalTrades
            });
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to save bot state', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stateFile: this.config.stateFile
            });
        }
    }
    /**
     * Load state from file
     */
    loadState() {
        try {
            const stateFile = this.config.stateFile || './bot-state.json';
            if (fs_1.default.existsSync(stateFile)) {
                const data = fs_1.default.readFileSync(stateFile, 'utf8');
                const loadedState = JSON.parse(data);
                structured_logger_1.logger.info('Bot state loaded from file', {
                    activeSnipes: loadedState.activeSnipes?.length || 0,
                    poolsCached: loadedState.poolsCache?.length || 0,
                    totalTrades: loadedState.profitStats?.totalTrades || 0,
                    lastSaved: new Date(loadedState.timestamp).toISOString()
                });
                // Merge with defaults to ensure all required fields exist
                return this.mergeWithDefaults(loadedState);
            }
        }
        catch (error) {
            structured_logger_1.logger.error('Failed to load bot state', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        structured_logger_1.logger.info('Creating new bot state');
        return this.getDefaultState();
    }
    /**
     * Create backup of state file
     */
    createBackup(stateFile) {
        try {
            const maxBackups = this.config.maxBackups || 5;
            const backupBase = stateFile.replace('.json', '');
            // Rotate existing backups
            for (let i = maxBackups - 1; i > 0; i--) {
                const oldBackup = `${backupBase}.backup.${i}.json`;
                const newBackup = `${backupBase}.backup.${i + 1}.json`;
                if (fs_1.default.existsSync(oldBackup)) {
                    if (i === maxBackups - 1) {
                        fs_1.default.unlinkSync(oldBackup); // Delete oldest
                    }
                    else {
                        fs_1.default.renameSync(oldBackup, newBackup);
                    }
                }
            }
            // Create new backup
            const newBackup = `${backupBase}.backup.1.json`;
            fs_1.default.copyFileSync(stateFile, newBackup);
        }
        catch (error) {
            structured_logger_1.logger.warn('Failed to create state backup', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Merge loaded state with defaults
     */
    mergeWithDefaults(loadedState) {
        const defaultState = this.getDefaultState();
        return {
            version: loadedState.version || defaultState.version,
            timestamp: loadedState.timestamp || defaultState.timestamp,
            activeSnipes: Array.isArray(loadedState.activeSnipes) ? loadedState.activeSnipes : [],
            errorCounters: {
                totalErrors: loadedState.errorCounters?.totalErrors || 0,
                errorsByType: loadedState.errorCounters?.errorsByType || {},
                errorsByApi: loadedState.errorCounters?.errorsByApi || {},
                lastErrorTime: loadedState.errorCounters?.lastErrorTime || 0,
                consecutiveErrors: loadedState.errorCounters?.consecutiveErrors || 0
            },
            poolsCache: Array.isArray(loadedState.poolsCache) ? loadedState.poolsCache : [],
            profitStats: {
                totalTrades: loadedState.profitStats?.totalTrades || 0,
                successfulTrades: loadedState.profitStats?.successfulTrades || 0,
                totalProfit: loadedState.profitStats?.totalProfit || 0,
                totalLoss: loadedState.profitStats?.totalLoss || 0,
                bestTrade: loadedState.profitStats?.bestTrade || 0,
                worstTrade: loadedState.profitStats?.worstTrade || 0,
                avgTradeSize: loadedState.profitStats?.avgTradeSize || 0
            },
            runtimeStats: {
                startTime: loadedState.runtimeStats?.startTime || Date.now(),
                uptime: 0,
                lastHealthCheck: Date.now(),
                memoryUsage: process.memoryUsage(),
                wsConnections: loadedState.runtimeStats?.wsConnections || {},
                configReloads: loadedState.runtimeStats?.configReloads || 0
            }
        };
    }
    /**
     * Get default state
     */
    getDefaultState() {
        return {
            version: '1.0.0',
            timestamp: Date.now(),
            activeSnipes: [],
            errorCounters: {
                totalErrors: 0,
                errorsByType: {},
                errorsByApi: {},
                lastErrorTime: 0,
                consecutiveErrors: 0
            },
            poolsCache: [],
            profitStats: {
                totalTrades: 0,
                successfulTrades: 0,
                totalProfit: 0,
                totalLoss: 0,
                bestTrade: 0,
                worstTrade: 0,
                avgTradeSize: 0
            },
            runtimeStats: {
                startTime: Date.now(),
                uptime: 0,
                lastHealthCheck: Date.now(),
                memoryUsage: process.memoryUsage(),
                wsConnections: {},
                configReloads: 0
            }
        };
    }
    /**
     * Get recovery information for restart scenarios
     */
    getRecoveryInfo() {
        return {
            hasRecoverableState: this.state.activeSnipes.length > 0 || this.state.errorCounters.totalErrors > 0,
            activeSnipes: this.state.activeSnipes,
            recentErrors: this.state.errorCounters.consecutiveErrors,
            uptime: this.state.runtimeStats.uptime,
            lastHealthCheck: new Date(this.state.runtimeStats.lastHealthCheck)
        };
    }
    /**
     * Cleanup resources
     */
    destroy() {
        this.stopAutoSave();
        this.saveState();
    }
}
exports.StatePersistence = StatePersistence;
// Global state persistence instance
exports.statePersistence = new StatePersistence();
