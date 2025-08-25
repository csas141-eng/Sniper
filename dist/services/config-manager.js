"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configManager = exports.ConfigManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Configuration manager with hot-reload capability
 */
class ConfigManager {
    configPath;
    config = {};
    listeners = [];
    watcherActive = false;
    fileWatcher;
    lastModified = 0;
    constructor(configPath = './config.json') {
        this.configPath = path_1.default.resolve(configPath);
        this.loadConfig();
    }
    /**
     * Load configuration from file
     */
    loadConfig() {
        try {
            const configData = fs_1.default.readFileSync(this.configPath, 'utf8');
            // Remove comments from JSON (basic comment removal for // style)
            const cleanedData = configData
                .split('\n')
                .map(line => {
                // Remove single line comments, but preserve strings with //
                const commentIndex = line.indexOf('//');
                if (commentIndex !== -1) {
                    // Check if // is inside a string
                    const beforeComment = line.substring(0, commentIndex);
                    const quotes = (beforeComment.match(/"/g) || []).length;
                    if (quotes % 2 === 0) {
                        // Even number of quotes means // is outside string
                        return line.substring(0, commentIndex).trim();
                    }
                }
                return line;
            })
                .join('\n');
            const newConfig = JSON.parse(cleanedData);
            const oldConfig = this.config;
            // Detect changes
            const changedKeys = this.detectChangedKeys(oldConfig, newConfig);
            this.config = newConfig;
            // Notify listeners if there are changes
            if (changedKeys.length > 0 && Object.keys(oldConfig).length > 0) {
                const event = {
                    oldConfig,
                    newConfig,
                    changedKeys,
                    timestamp: new Date()
                };
                this.notifyListeners(event);
            }
            return this.config;
        }
        catch (error) {
            console.error('Error loading config file:', error);
            if (Object.keys(this.config).length === 0) {
                // Return minimal default config if no config exists
                this.config = this.getDefaultConfig();
            }
            return this.config;
        }
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config }; // Return deep copy
    }
    /**
     * Get configuration value by path (e.g., 'retrySettings.maxRetries')
     */
    get(keyPath, defaultValue) {
        const keys = keyPath.split('.');
        let value = this.config;
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            }
            else {
                return defaultValue;
            }
        }
        return value;
    }
    /**
     * Set configuration value (in memory only - doesn't persist)
     */
    set(keyPath, value) {
        const keys = keyPath.split('.');
        let current = this.config;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        current[keys[keys.length - 1]] = value;
    }
    /**
     * Start watching config file for changes
     */
    startHotReload() {
        if (this.watcherActive)
            return;
        try {
            this.fileWatcher = setInterval(() => {
                try {
                    const stats = fs_1.default.statSync(this.configPath);
                    if (stats.mtime.getTime() !== this.lastModified) {
                        this.lastModified = stats.mtime.getTime();
                        console.log('🔄 Config file changed, reloading...');
                        try {
                            this.loadConfig();
                            console.log('✅ Configuration reloaded successfully');
                        }
                        catch (error) {
                            console.error('❌ Failed to reload configuration:', error);
                        }
                    }
                }
                catch (error) {
                    // File might not exist, ignore
                }
            }, 1000);
            this.watcherActive = true;
            try {
                this.lastModified = fs_1.default.statSync(this.configPath).mtime.getTime();
            }
            catch {
                this.lastModified = 0;
            }
            console.log('🔍 Config hot-reload enabled');
        }
        catch (error) {
            console.error('Failed to start config file watcher:', error);
        }
    }
    /**
     * Stop watching config file
     */
    stopHotReload() {
        if (this.fileWatcher) {
            clearInterval(this.fileWatcher);
            this.fileWatcher = undefined;
        }
        this.watcherActive = false;
        console.log('🔍 Config hot-reload disabled');
    }
    /**
     * Add listener for configuration changes
     */
    onConfigChange(listener) {
        this.listeners.push(listener);
    }
    /**
     * Remove configuration change listener
     */
    removeConfigChangeListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
    /**
     * Notify all listeners of configuration changes
     */
    notifyListeners(event) {
        console.log(`🔄 Configuration changed: ${event.changedKeys.join(', ')}`);
        for (const listener of this.listeners) {
            try {
                listener(event);
            }
            catch (error) {
                console.error('Error in config change listener:', error);
            }
        }
    }
    /**
     * Detect which configuration keys have changed
     */
    detectChangedKeys(oldConfig, newConfig, prefix = '') {
        const changes = [];
        // Check all keys in new config
        for (const key in newConfig) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const oldValue = oldConfig?.[key];
            const newValue = newConfig[key];
            if (oldValue === undefined) {
                changes.push(`${fullKey} (added)`);
            }
            else if (typeof newValue === 'object' && newValue !== null && typeof oldValue === 'object' && oldValue !== null) {
                changes.push(...this.detectChangedKeys(oldValue, newValue, fullKey));
            }
            else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                changes.push(`${fullKey} (modified)`);
            }
        }
        // Check for deleted keys
        for (const key in oldConfig || {}) {
            if (!(key in newConfig)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                changes.push(`${fullKey} (deleted)`);
            }
        }
        return changes;
    }
    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            solanaRpcUrl: "https://api.mainnet-beta.solana.com",
            buyAmountSol: 0.01,
            slippage: 0.1,
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
            circuitBreaker: {
                enabled: true,
                dailyLossThreshold: 1.0,
                singleLossThreshold: 0.5,
                errorThreshold: 10,
                recoveryTimeMs: 300000
            },
            logging: {
                level: "info",
                structured: true,
                includeTimestamp: true,
                includeContext: true
            }
        };
    }
    /**
     * Validate configuration against a schema (basic validation)
     */
    validateConfig() {
        const errors = [];
        // Basic validation rules
        const required = ['solanaRpcUrl', 'buyAmountSol', 'slippage'];
        for (const key of required) {
            if (!(key in this.config)) {
                errors.push(`Missing required field: ${key}`);
            }
        }
        // Type validation
        if (typeof this.config.buyAmountSol !== 'number' || this.config.buyAmountSol <= 0) {
            errors.push('buyAmountSol must be a positive number');
        }
        if (typeof this.config.slippage !== 'number' || this.config.slippage < 0 || this.config.slippage > 1) {
            errors.push('slippage must be a number between 0 and 1');
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    /**
     * Reload configuration manually
     */
    reload() {
        console.log('🔄 Manually reloading configuration...');
        return this.loadConfig();
    }
    /**
     * Cleanup resources
     */
    destroy() {
        this.stopHotReload();
        this.listeners = [];
    }
}
exports.ConfigManager = ConfigManager;
// Global configuration manager instance
exports.configManager = new ConfigManager();
// Start hot-reload by default in non-production environments
if (process.env.NODE_ENV !== 'production') {
    exports.configManager.startHotReload();
}
