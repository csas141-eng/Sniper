"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressBlacklist = exports.AddressBlacklist = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const web3_js_1 = require("@solana/web3.js");
const structured_logger_1 = require("./structured-logger");
const notifications_1 = require("./notifications");
/**
 * Address blacklist system to prevent interaction with known drainer addresses
 */
class AddressBlacklist {
    blacklistPath;
    blacklistData;
    knownDrainers;
    watchInterval;
    constructor(blacklistPath = './data/blacklist.json') {
        this.blacklistPath = blacklistPath;
        this.knownDrainers = new Set();
        this.blacklistData = this.initializeBlacklist();
        this.loadBlacklist();
        this.startWatchingForUpdates();
    }
    /**
     * Initialize blacklist structure
     */
    initializeBlacklist() {
        return {
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            entries: [],
            metadata: {
                totalEntries: 0,
                sources: ['manual', 'automatic', 'remote'],
                categories: ['drainer', 'scam', 'rug_pull', 'suspicious']
            }
        };
    }
    /**
     * Load blacklist from file
     */
    loadBlacklist() {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.blacklistPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            if (fs.existsSync(this.blacklistPath)) {
                const data = fs.readFileSync(this.blacklistPath, 'utf8');
                this.blacklistData = JSON.parse(data);
                // Rebuild the set for fast lookups
                this.knownDrainers.clear();
                this.blacklistData.entries.forEach(entry => {
                    this.knownDrainers.add(entry.address.toLowerCase());
                });
                structured_logger_1.logger.info(`📋 Loaded blacklist with ${this.blacklistData.entries.length} entries`);
            }
            else {
                // Create initial blacklist with known drainer addresses
                this.addKnownDrainers();
                this.saveBlacklist();
                structured_logger_1.logger.info('📋 Created initial blacklist');
            }
        }
        catch (error) {
            structured_logger_1.logger.error('Error loading blacklist', { error: error instanceof Error ? error.message : 'Unknown error' });
            this.blacklistData = this.initializeBlacklist();
        }
    }
    /**
     * Add known drainer addresses to blacklist
     */
    addKnownDrainers() {
        const knownDrainers = [
            // Known drainer addresses - these are examples and should be updated with real addresses
            {
                address: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
                reason: 'Known drainer wallet',
                severity: 'critical',
                description: 'Identified as draining user wallets through malicious smart contracts'
            },
            {
                address: 'DRaiNXvKgNqGJLCvQLbCJCYKKaRtc7vKcqjAuRrDtHHD',
                reason: 'Drainer contract',
                severity: 'critical',
                description: 'Smart contract designed to drain tokens from user wallets'
            }
        ];
        knownDrainers.forEach(drainer => {
            this.addToBlacklist(drainer.address, drainer.reason, 'automatic', drainer.severity, drainer.description);
        });
    }
    /**
     * Check if an address is blacklisted
     */
    isBlacklisted(address) {
        const normalizedAddress = address.toLowerCase();
        if (this.knownDrainers.has(normalizedAddress)) {
            const entry = this.blacklistData.entries.find(e => e.address.toLowerCase() === normalizedAddress);
            return { blacklisted: true, entry };
        }
        return { blacklisted: false };
    }
    /**
     * Add address to blacklist
     */
    addToBlacklist(address, reason, source = 'manual', severity = 'medium', description, reportedBy) {
        try {
            // Validate address format
            new web3_js_1.PublicKey(address);
            const normalizedAddress = address.toLowerCase();
            // Check if already exists
            if (this.knownDrainers.has(normalizedAddress)) {
                structured_logger_1.logger.warn(`Address ${address} is already blacklisted`);
                return false;
            }
            const entry = {
                address: address,
                reason,
                dateAdded: new Date().toISOString(),
                source,
                severity,
                description,
                reportedBy
            };
            this.blacklistData.entries.push(entry);
            this.knownDrainers.add(normalizedAddress);
            this.blacklistData.metadata.totalEntries = this.blacklistData.entries.length;
            this.blacklistData.lastUpdated = new Date().toISOString();
            this.saveBlacklist();
            structured_logger_1.logger.info(`🚫 Added address to blacklist: ${address} (${reason})`);
            // Send notification for critical entries
            if (severity === 'critical') {
                notifications_1.notificationService.sendNotification(`Critical address added to blacklist: ${address}`, 'warning', { address, reason, severity });
            }
            return true;
        }
        catch (error) {
            structured_logger_1.logger.error('Error adding address to blacklist', {
                address,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    /**
     * Remove address from blacklist
     */
    removeFromBlacklist(address) {
        const normalizedAddress = address.toLowerCase();
        const index = this.blacklistData.entries.findIndex(e => e.address.toLowerCase() === normalizedAddress);
        if (index === -1) {
            return false;
        }
        this.blacklistData.entries.splice(index, 1);
        this.knownDrainers.delete(normalizedAddress);
        this.blacklistData.metadata.totalEntries = this.blacklistData.entries.length;
        this.blacklistData.lastUpdated = new Date().toISOString();
        this.saveBlacklist();
        structured_logger_1.logger.info(`✅ Removed address from blacklist: ${address}`);
        return true;
    }
    /**
     * Save blacklist to file
     */
    saveBlacklist() {
        try {
            fs.writeFileSync(this.blacklistPath, JSON.stringify(this.blacklistData, null, 2));
        }
        catch (error) {
            structured_logger_1.logger.error('Error saving blacklist', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
    /**
     * Get blacklist statistics
     */
    getStatistics() {
        const bySeverity = this.blacklistData.entries.reduce((acc, entry) => {
            acc[entry.severity] = (acc[entry.severity] || 0) + 1;
            return acc;
        }, {});
        const bySource = this.blacklistData.entries.reduce((acc, entry) => {
            acc[entry.source] = (acc[entry.source] || 0) + 1;
            return acc;
        }, {});
        return {
            totalEntries: this.blacklistData.entries.length,
            bySeverity,
            bySource,
            lastUpdated: this.blacklistData.lastUpdated
        };
    }
    /**
     * Export blacklist for sharing
     */
    exportBlacklist() {
        return JSON.stringify(this.blacklistData, null, 2);
    }
    /**
     * Import blacklist from external source
     */
    importBlacklist(data, source = 'remote') {
        try {
            const importedData = JSON.parse(data);
            let addedCount = 0;
            importedData.entries.forEach(entry => {
                if (!this.knownDrainers.has(entry.address.toLowerCase())) {
                    entry.source = source;
                    entry.dateAdded = new Date().toISOString();
                    this.addToBlacklist(entry.address, entry.reason, source, entry.severity, entry.description, entry.reportedBy);
                    addedCount++;
                }
            });
            structured_logger_1.logger.info(`📥 Imported ${addedCount} new addresses from external blacklist`);
            return addedCount;
        }
        catch (error) {
            structured_logger_1.logger.error('Error importing blacklist', { error: error instanceof Error ? error.message : 'Unknown error' });
            return 0;
        }
    }
    /**
     * Start watching for file updates
     */
    startWatchingForUpdates() {
        this.watchInterval = setInterval(() => {
            try {
                if (fs.existsSync(this.blacklistPath)) {
                    const stats = fs.statSync(this.blacklistPath);
                    const lastModified = stats.mtime.toISOString();
                    if (lastModified > this.blacklistData.lastUpdated) {
                        structured_logger_1.logger.info('📋 Blacklist file updated externally, reloading...');
                        this.loadBlacklist();
                    }
                }
            }
            catch (error) {
                // Silent error - file watching is optional
            }
        }, 30000); // Check every 30 seconds
    }
    /**
     * Stop watching for updates
     */
    destroy() {
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
        }
    }
    /**
     * Validate multiple addresses at once
     */
    validateAddresses(addresses) {
        const safe = [];
        const blacklisted = [];
        addresses.forEach(address => {
            const result = this.isBlacklisted(address);
            if (result.blacklisted && result.entry) {
                blacklisted.push({ address, entry: result.entry });
                // Log blacklist hit
                structured_logger_1.logger.warn('🚫 Blacklisted address detected', {
                    address,
                    reason: result.entry.reason,
                    severity: result.entry.severity
                });
                // Send notification for medium+ severity
                if (result.entry.severity !== 'low') {
                    notifications_1.notificationService.sendNotification(`Blacklisted address detected: ${address}`, 'warning', { address, reason: result.entry.reason, severity: result.entry.severity });
                }
            }
            else {
                safe.push(address);
            }
        });
        return { safe, blacklisted };
    }
}
exports.AddressBlacklist = AddressBlacklist;
// Export singleton instance
exports.addressBlacklist = new AddressBlacklist();
