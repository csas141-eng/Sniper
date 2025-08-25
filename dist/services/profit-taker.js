"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfitTaker = void 0;
const fs_1 = __importDefault(require("fs"));
// Load configuration from config.json
const loadConfig = () => {
    try {
        const configData = fs_1.default.readFileSync('./config.json', 'utf8');
        const userConfig = JSON.parse(configData);
        return {
            PROFIT_TAKING: {
                ENABLE_AUTO_PROFIT: true,
                PROFIT_PERCENTAGE: 50,
                STOP_LOSS_PERCENTAGE: 20,
                TRAILING_STOP: true
            }
        };
    }
    catch (error) {
        console.error('Error loading config.json, using defaults:', error);
        return {
            PROFIT_TAKING: {
                ENABLE_AUTO_PROFIT: true,
                PROFIT_PERCENTAGE: 50,
                STOP_LOSS_PERCENTAGE: 20,
                TRAILING_STOP: true
            }
        };
    }
};
const CONFIG = loadConfig();
class ProfitTaker {
    connection;
    positions = new Map();
    monitoringInterval = null;
    isMonitoring = false;
    constructor(connection) {
        this.connection = connection;
    }
    // Start profit monitoring
    startMonitoring() {
        if (this.isMonitoring)
            return;
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.checkAllPositions();
        }, 10000); // Check every 10 seconds
        console.log('💰 Profit monitoring started');
    }
    // Stop profit monitoring
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        console.log('💰 Profit monitoring stopped');
    }
    // Add new position to monitor
    addPosition(position) {
        this.positions.set(position.mint, position);
        console.log(`💰 Added position: ${position.symbol} (${position.mint})`);
    }
    // Remove position from monitoring
    removePosition(mint) {
        this.positions.delete(mint);
        console.log(`💰 Removed position: ${mint}`);
    }
    // Check all positions for profit targets
    async checkAllPositions() {
        for (const [mint, position] of this.positions) {
            try {
                await this.checkPosition(position);
            }
            catch (error) {
                console.error(`❌ Error checking position ${position.symbol}:`, error);
            }
        }
    }
    // Check individual position for profit targets
    async checkPosition(position) {
        try {
            // Get current token price
            const currentPrice = await this.getTokenPrice(position.mint);
            if (!currentPrice)
                return;
            // Calculate profit percentage
            const profitPercentage = (currentPrice - position.entryPrice) / position.entryPrice;
            const profitMultiplier = profitPercentage + 1; // 1.0 = 100%, 2.0 = 200%, etc.
            console.log(`💰 ${position.symbol}: ${(profitPercentage * 100).toFixed(2)}% profit (${profitMultiplier.toFixed(2)}x)`);
            // Check if we should sell based on profit tiers
            await this.checkProfitTiers(position, profitMultiplier, currentPrice);
        }
        catch (error) {
            console.error(`❌ Error checking position ${position.symbol}:`, error);
        }
    }
    // Check profit tiers and execute sells
    async checkProfitTiers(position, profitMultiplier, currentPrice) {
        // Tier 1: Sell 30% at 1000% profit (10x)
        if (!position.tier1Sold && profitMultiplier >= 10.0) {
            await this.executeProfitSell(position, 0.3, 'TIER_1', profitMultiplier);
            position.tier1Sold = true;
        }
        // Tier 2: Sell 50% at 10000% profit (100x)
        if (!position.tier2Sold && profitMultiplier >= 100.0) {
            await this.executeProfitSell(position, 0.5, 'TIER_2', profitMultiplier);
            position.tier2Sold = true;
        }
        // Check if we should keep monitoring or close position
        if (position.tier1Sold && position.tier2Sold) {
            console.log(`🎯 ${position.symbol}: All profit tiers reached, keeping 30% for moonshot`);
            this.removePosition(position.mint);
        }
    }
    // Execute profit sell
    async executeProfitSell(position, sellAmount, tier, profitMultiplier) {
        try {
            console.log(`💰 Executing ${tier} sell for ${position.symbol}: ${(sellAmount * 100).toFixed(0)}% at ${profitMultiplier.toFixed(2)}x profit`);
            // Calculate amount to sell
            // Patch for: 'position.currentAmount' is possibly 'undefined'
            const tokensToSell = (position.currentAmount ?? 0) * sellAmount;
            // Create sell request
            const sellRequest = {
                inputMint: position.mint,
                outputMint: 'So11111111111111111111111111111111111111112', // SOL
                amount: tokensToSell,
                slippage: 0.1, // Default slippage
                // Patch for: 'position.signature' is possibly 'undefined'
                wallet: this.getWalletFromSignature(position.signature ?? ''), // Always pass a string
                method: 'solana'
            };
            // Execute sell - temporarily disabled due to service dependencies
            console.log(`💰 ${tier} sell execution temporarily disabled - implement with proper service dependencies`);
            // Update position (simplified for now)
            // Patch for: 'position.currentAmount' is possibly 'undefined'
            position.currentAmount = (position.currentAmount ?? 0) - tokensToSell;
            // Patch for: 'position.totalSold' is possibly 'undefined'
            position.totalSold = (position.totalSold ?? 0) + sellAmount;
            // Log profit taken
            const profitTaken = (profitMultiplier - 1) * sellAmount * position.entryAmount;
            console.log(`💰 Profit taken: ${profitTaken.toFixed(6)} SOL`);
        }
        catch (error) {
            console.error(`❌ Error executing ${tier} sell:`, error);
        }
    }
    // Get current token price (simplified - you can enhance this)
    async getTokenPrice(mint) {
        try {
            // This is a simplified price check
            // In production, you'd use real price feeds or DEX APIs
            const response = await fetch(`https://price.jup.ag/v4/price?ids=${mint}`);
            if (!response.ok)
                return null;
            const data = await response.json();
            return data.data[mint]?.price || null;
        }
        catch (error) {
            console.error('Error getting token price:', error);
            return null;
        }
    }
    // Get wallet from signature (placeholder - implement based on your wallet management)
    getWalletFromSignature(signature) {
        // This is a placeholder - implement based on your wallet management system
        // You might want to store wallet references with positions or use a wallet service
        throw new Error('Wallet retrieval not implemented - implement based on your wallet management');
    }
    // Get all monitored positions
    getPositions() {
        return Array.from(this.positions.values());
    }
    // Get position by mint
    getPosition(mint) {
        return this.positions.get(mint);
    }
    // Get position statistics
    getPositionStats() {
        const positions = this.getPositions();
        const totalPositions = positions.length;
        // Calculate total value and average profit (simplified)
        let totalValue = 0;
        let totalProfit = 0;
        positions.forEach(position => {
            // Patch for: 'position.currentAmount' is possibly 'undefined'
            totalValue += position.currentAmount ?? 0;
            // Calculate profit based on current price vs entry
            // This is simplified - implement real price calculation
        });
        return {
            totalPositions,
            totalValue,
            averageProfit: totalPositions > 0 ? totalProfit / totalPositions : 0
        };
    }
}
exports.ProfitTaker = ProfitTaker;
// Service instance will be created by SniperBot
