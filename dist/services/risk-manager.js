"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.riskManager = exports.RiskManager = void 0;
const fs_1 = __importDefault(require("fs"));
// Load configuration from config.json
const loadConfig = () => {
    try {
        const configData = fs_1.default.readFileSync('./config.json', 'utf8');
        const userConfig = JSON.parse(configData);
        return {
            RISK_MANAGEMENT: {
                maxDailyLoss: 1.0,
                maxSingleLoss: 0.5,
                tradeCooldown: 5000,
                maxPositions: 5,
                minLiquidity: 10,
                maxTxAge: 1
            }
        };
    }
    catch (error) {
        console.error('Error loading config.json, using defaults:', error);
        return {
            RISK_MANAGEMENT: {
                maxDailyLoss: 1.0,
                maxSingleLoss: 0.5,
                tradeCooldown: 5000,
                maxPositions: 5,
                minLiquidity: 10,
                maxTxAge: 1
            }
        };
    }
};
const CONFIG = loadConfig();
class RiskManager {
    dailyStats;
    activePositions;
    tradeHistory;
    lastTradeTime;
    dailyResetInterval;
    constructor() {
        this.dailyStats = {
            totalTrades: 0,
            profitableTrades: 0,
            losingTrades: 0,
            totalProfit: 0,
            totalLoss: 0,
            netPnL: 0,
            startTime: new Date(),
        };
        this.activePositions = new Map();
        this.tradeHistory = [];
        this.lastTradeTime = 0;
        // Reset daily stats at midnight
        this.scheduleDailyReset();
    }
    // Check if a new trade is allowed
    canExecuteTrade(amount, tokenMint) {
        const now = Date.now();
        const errors = [];
        // Check daily loss limit
        if (this.dailyStats.netPnL <= -CONFIG.RISK_MANAGEMENT.maxDailyLoss) {
            errors.push(`Daily loss limit reached: ${this.dailyStats.netPnL.toFixed(4)} SOL`);
        }
        // Check single trade loss limit
        if (amount > CONFIG.RISK_MANAGEMENT.maxSingleLoss) {
            errors.push(`Trade amount ${amount} SOL exceeds single trade limit ${CONFIG.RISK_MANAGEMENT.maxSingleLoss} SOL`);
        }
        // Check position limit
        if (this.activePositions.size >= CONFIG.RISK_MANAGEMENT.maxPositions) {
            errors.push(`Maximum positions limit reached: ${this.activePositions.size}/${CONFIG.RISK_MANAGEMENT.maxPositions}`);
        }
        // Check cooldown period
        if (now - this.lastTradeTime < CONFIG.RISK_MANAGEMENT.tradeCooldown) {
            const remainingCooldown = CONFIG.RISK_MANAGEMENT.tradeCooldown - (now - this.lastTradeTime);
            errors.push(`Trade cooldown active: ${Math.ceil(remainingCooldown / 1000)}s remaining`);
        }
        // Check if token is already in active positions
        if (this.activePositions.has(tokenMint)) {
            errors.push(`Token ${tokenMint} already has an active position`);
        }
        if (errors.length > 0) {
            console.warn('Trade blocked by risk manager', { errors, amount, tokenMint });
            return { allowed: false, errors };
        }
        return { allowed: true, errors: [] };
    }
    // Record a new trade
    recordTrade(tradeType, tokenMint, amount, price, txHash) {
        const now = Date.now();
        this.lastTradeTime = now;
        const trade = {
            id: `${tokenMint}-${now}`,
            type: tradeType,
            tokenMint,
            amount,
            price,
            txHash,
            timestamp: now,
            status: 'pending',
        };
        if (tradeType === 'buy') {
            this.activePositions.set(tokenMint, {
                entryPrice: price,
                entryAmount: amount,
                entryTime: now,
                entryValue: amount * price,
                currentPrice: price,
                tradeId: trade.id,
            });
            console.log(`Position opened: ${tokenMint}`, {
                entryPrice: price,
                entryAmount: amount,
                entryValue: amount * price,
            });
        }
        else if (tradeType === 'sell') {
            const position = this.activePositions.get(tokenMint);
            if (position) {
                const profit = (price - position.entryPrice) * amount;
                this.updateDailyStats(profit);
                this.activePositions.delete(tokenMint);
                console.log(`Position closed: ${tokenMint}`, {
                    profit: profit.toFixed(4),
                    profitPercentage: ((profit / position.entryValue) * 100).toFixed(2) + '%'
                });
            }
        }
        this.tradeHistory.push(trade);
    }
    // Update daily statistics
    updateDailyStats(profit) {
        this.dailyStats.totalTrades++;
        if (profit > 0) {
            this.dailyStats.profitableTrades++;
            this.dailyStats.totalProfit += profit;
        }
        else {
            this.dailyStats.losingTrades++;
            this.dailyStats.totalLoss += Math.abs(profit);
        }
        this.dailyStats.netPnL = this.dailyStats.totalProfit - this.dailyStats.totalLoss;
    }
    // Get current risk status
    getRiskStatus() {
        return {
            dailyStats: { ...this.dailyStats },
            activePositions: this.activePositions.size,
            maxPositions: CONFIG.RISK_MANAGEMENT.maxPositions,
            dailyLossLimit: CONFIG.RISK_MANAGEMENT.maxDailyLoss,
            singleLossLimit: CONFIG.RISK_MANAGEMENT.maxSingleLoss,
            canTrade: this.dailyStats.netPnL > -CONFIG.RISK_MANAGEMENT.maxDailyLoss
        };
    }
    // Get daily statistics
    getDailyStats() {
        return { ...this.dailyStats };
    }
    // Get active positions
    getActivePositions() {
        return new Map(this.activePositions);
    }
    // Schedule daily reset at midnight
    scheduleDailyReset() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const timeUntilMidnight = tomorrow.getTime() - now.getTime();
        this.dailyResetInterval = setTimeout(() => {
            this.resetDailyStats();
            this.scheduleDailyReset(); // Schedule next reset
        }, timeUntilMidnight);
    }
    // Reset daily statistics
    resetDailyStats() {
        console.log('Resetting daily statistics');
        this.dailyStats = {
            totalTrades: 0,
            profitableTrades: 0,
            losingTrades: 0,
            totalProfit: 0,
            totalLoss: 0,
            netPnL: 0,
            startTime: new Date(),
        };
    }
    // Cleanup method
    cleanup() {
        if (this.dailyResetInterval) {
            clearTimeout(this.dailyResetInterval);
        }
    }
}
exports.RiskManager = RiskManager;
// Export singleton instance
exports.riskManager = new RiskManager();
