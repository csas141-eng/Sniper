"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SniperBotUtils = exports.SolanaUtils = exports.isValidConnection = exports.isValidPublicKey = exports.isValidNumber = exports.isValidString = exports.ValidationError = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
// Input validation utilities
class ValidationError extends Error {
    field;
    value;
    constructor(message, field, value) {
        super(message);
        this.field = field;
        this.value = value;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
// Type guards for input validation
const isValidString = (value, fieldName, minLength = 1) => {
    if (typeof value !== 'string') {
        throw new ValidationError(`${fieldName} must be a string`, fieldName, value);
    }
    if (value.length < minLength) {
        throw new ValidationError(`${fieldName} must be at least ${minLength} characters long`, fieldName, value);
    }
    return value;
};
exports.isValidString = isValidString;
const isValidNumber = (value, fieldName, min, max) => {
    if (typeof value !== 'number' || isNaN(value)) {
        throw new ValidationError(`${fieldName} must be a valid number`, fieldName, value);
    }
    if (min !== undefined && value < min) {
        throw new ValidationError(`${fieldName} must be at least ${min}`, fieldName, value);
    }
    if (max !== undefined && value > max) {
        throw new ValidationError(`${fieldName} must be at most ${max}`, fieldName, value);
    }
    return value;
};
exports.isValidNumber = isValidNumber;
const isValidPublicKey = (value, fieldName) => {
    try {
        if (typeof value === 'string') {
            return new web3_js_1.PublicKey(value);
        }
        else if (value instanceof web3_js_1.PublicKey) {
            return value;
        }
        else {
            throw new Error('Invalid type');
        }
    }
    catch (error) {
        throw new ValidationError(`${fieldName} must be a valid PublicKey`, fieldName, value);
    }
};
exports.isValidPublicKey = isValidPublicKey;
const isValidConnection = (connection, fieldName = 'connection') => {
    if (!connection || typeof connection.getLatestBlockhash !== 'function') {
        throw new ValidationError(`${fieldName} must be a valid Connection instance`, fieldName, connection);
    }
    return connection;
};
exports.isValidConnection = isValidConnection;
/**
 * Pure, stateless utility functions for Solana operations
 * All functions include robust input validation and type guards
 */
exports.SolanaUtils = {
    /**
     * Validate if a string is a valid token mint address
     */
    isValidTokenMint: (mintAddress) => {
        try {
            (0, exports.isValidString)(mintAddress, 'mintAddress', 32);
            new web3_js_1.PublicKey(mintAddress);
            return true;
        }
        catch (error) {
            return false;
        }
    },
    /**
     * Get token account balance (pure function - requires connection to be passed)
     */
    getTokenBalance: async (connection, tokenMint, walletAddress) => {
        const validConnection = (0, exports.isValidConnection)(connection);
        const validTokenMint = (0, exports.isValidString)(tokenMint, 'tokenMint', 32);
        const validWalletAddress = (0, exports.isValidString)(walletAddress, 'walletAddress', 32);
        try {
            const mint = new web3_js_1.PublicKey(validTokenMint);
            const wallet = new web3_js_1.PublicKey(validWalletAddress);
            const tokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(mint, wallet);
            const accountInfo = await validConnection.getAccountInfo(tokenAccount);
            if (!accountInfo)
                return 0;
            // Parse token balance from account data
            // This is a simplified version - in practice, you'd need proper SPL token parsing
            return accountInfo.data.length;
        }
        catch (error) {
            throw new ValidationError(`Error getting token balance: ${error instanceof Error ? error.message : 'Unknown error'}`, 'tokenBalance', { tokenMint: validTokenMint, walletAddress: validWalletAddress });
        }
    },
    /**
     * Get wallet SOL balance
     */
    getWalletBalance: async (connection, walletAddress) => {
        const validConnection = (0, exports.isValidConnection)(connection);
        const validWalletAddress = (0, exports.isValidString)(walletAddress, 'walletAddress', 32);
        try {
            const wallet = new web3_js_1.PublicKey(validWalletAddress);
            const balance = await validConnection.getBalance(wallet);
            return balance / 1e9; // Convert lamports to SOL
        }
        catch (error) {
            throw new ValidationError(`Error getting wallet balance: ${error instanceof Error ? error.message : 'Unknown error'}`, 'walletBalance', walletAddress);
        }
    },
    /**
     * Validate developer address
     */
    validateDeveloperAddress: async (connection, address) => {
        const validConnection = (0, exports.isValidConnection)(connection);
        const validAddress = (0, exports.isValidString)(address, 'address', 32);
        try {
            const pubkey = new web3_js_1.PublicKey(validAddress);
            const accountInfo = await validConnection.getAccountInfo(pubkey);
            return accountInfo !== null;
        }
        catch (error) {
            return false;
        }
    },
    /**
     * Get recent transactions for an address
     */
    getRecentTransactions: async (connection, address, limit = 10) => {
        const validConnection = (0, exports.isValidConnection)(connection);
        const validAddress = (0, exports.isValidString)(address, 'address', 32);
        const validLimit = (0, exports.isValidNumber)(limit, 'limit', 1, 1000);
        try {
            const pubkey = new web3_js_1.PublicKey(validAddress);
            const signatures = await validConnection.getSignaturesForAddress(pubkey, { limit: validLimit });
            const transactions = await Promise.all(signatures.map(async (sig) => {
                try {
                    const tx = await validConnection.getTransaction(sig.signature, {
                        maxSupportedTransactionVersion: 0
                    });
                    return {
                        signature: sig.signature,
                        slot: sig.slot,
                        blockTime: sig.blockTime,
                        transaction: tx
                    };
                }
                catch (error) {
                    return {
                        signature: sig.signature,
                        slot: sig.slot,
                        blockTime: sig.blockTime,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            }));
            return transactions;
        }
        catch (error) {
            throw new ValidationError(`Error getting recent transactions: ${error instanceof Error ? error.message : 'Unknown error'}`, 'recentTransactions', { address: validAddress, limit: validLimit });
        }
    },
    /**
     * Check RPC health
     */
    checkRPCHealth: async (connection) => {
        const validConnection = (0, exports.isValidConnection)(connection);
        try {
            const startTime = Date.now();
            await validConnection.getLatestBlockhash();
            const responseTime = Date.now() - startTime;
            return {
                healthy: responseTime < 5000, // 5 second threshold
                responseTime
            };
        }
        catch (error) {
            return {
                healthy: false,
                responseTime: -1
            };
        }
    },
    /**
     * Estimate transaction fees (pure calculation)
     */
    estimateTransactionFee: (instructionCount, priorityFee = 0) => {
        const validInstructionCount = (0, exports.isValidNumber)(instructionCount, 'instructionCount', 0);
        const validPriorityFee = (0, exports.isValidNumber)(priorityFee, 'priorityFee', 0);
        const baseFee = 5000; // Base fee in lamports
        const instructionFee = validInstructionCount * 200; // Per instruction fee
        return (baseFee + instructionFee + validPriorityFee) / 1e9; // Convert to SOL
    },
    /**
     * Format SOL amount (pure function)
     */
    formatSOL: (lamports, decimals = 9) => {
        const validLamports = (0, exports.isValidNumber)(lamports, 'lamports', 0);
        const validDecimals = (0, exports.isValidNumber)(decimals, 'decimals', 0, 18);
        return (validLamports / 1e9).toFixed(validDecimals);
    },
    /**
     * Format token amount (pure function)
     */
    formatTokenAmount: (amount, decimals = 9) => {
        const validAmount = (0, exports.isValidNumber)(amount, 'amount', 0);
        const validDecimals = (0, exports.isValidNumber)(decimals, 'decimals', 0, 18);
        return (validAmount / Math.pow(10, validDecimals)).toFixed(validDecimals);
    },
    /**
     * Generate performance report
     */
    generatePerformanceReport: async (connection) => {
        const validConnection = (0, exports.isValidConnection)(connection);
        try {
            const rpcHealth = await exports.SolanaUtils.checkRPCHealth(validConnection);
            const latestBlockhash = await validConnection.getLatestBlockhash();
            return {
                timestamp: new Date().toISOString(),
                rpcHealth,
                latestBlockhash: latestBlockhash.blockhash,
                slot: latestBlockhash.lastValidBlockHeight,
                connection: validConnection.rpcEndpoint
            };
        }
        catch (error) {
            throw new ValidationError(`Error generating performance report: ${error instanceof Error ? error.message : 'Unknown error'}`, 'performanceReport', connection.rpcEndpoint);
        }
    },
    /**
     * Calculate slippage amount (pure function)
     */
    calculateSlippageAmount: (amount, slippage) => {
        const validAmount = (0, exports.isValidNumber)(amount, 'amount', 0);
        const validSlippage = (0, exports.isValidNumber)(slippage, 'slippage', 0, 1);
        return validAmount * validSlippage;
    },
    /**
     * Calculate minimum out amount with slippage (pure function)
     */
    calculateMinimumOut: (expectedOut, slippage) => {
        const validExpectedOut = (0, exports.isValidNumber)(expectedOut, 'expectedOut', 0);
        const validSlippage = (0, exports.isValidNumber)(slippage, 'slippage', 0, 1);
        return validExpectedOut * (1 - validSlippage);
    },
    /**
     * Validate transaction signature format (pure function)
     */
    isValidTransactionSignature: (signature) => {
        try {
            const validSignature = (0, exports.isValidString)(signature, 'signature', 64);
            // Solana transaction signatures are base58 encoded and roughly 88 characters
            return validSignature.length >= 64 && validSignature.length <= 128;
        }
        catch (error) {
            return false;
        }
    },
    /**
     * Run comprehensive diagnostics
     */
    runDiagnostics: async (connection) => {
        const validConnection = (0, exports.isValidConnection)(connection);
        const rpcHealth = await exports.SolanaUtils.checkRPCHealth(validConnection);
        const performanceReport = await exports.SolanaUtils.generatePerformanceReport(validConnection);
        return {
            rpcHealth,
            performanceReport,
            timestamp: new Date().toISOString()
        };
    }
};
// Deprecated class kept for backward compatibility - use SolanaUtils instead
class SniperBotUtils {
    connection;
    constructor(connection) {
        this.connection = (0, exports.isValidConnection)(connection, 'connection');
        console.warn('SniperBotUtils is deprecated. Use SolanaUtils instead for pure, stateless functions.');
    }
    async isValidTokenMint(mintAddress) {
        return exports.SolanaUtils.isValidTokenMint(mintAddress);
    }
    async getTokenBalance(tokenMint, walletAddress) {
        return exports.SolanaUtils.getTokenBalance(this.connection, tokenMint, walletAddress);
    }
    async getWalletBalance(walletAddress) {
        return exports.SolanaUtils.getWalletBalance(this.connection, walletAddress);
    }
    async validateDeveloperAddress(address) {
        return exports.SolanaUtils.validateDeveloperAddress(this.connection, address);
    }
    async getRecentTransactions(address, limit = 10) {
        return exports.SolanaUtils.getRecentTransactions(this.connection, address, limit);
    }
    async checkRPCHealth() {
        const health = await exports.SolanaUtils.checkRPCHealth(this.connection);
        return health.healthy;
    }
    async estimateTransactionFee(instructions) {
        return exports.SolanaUtils.estimateTransactionFee(instructions.length);
    }
    formatSOL(lamports) {
        return exports.SolanaUtils.formatSOL(lamports);
    }
    formatTokenAmount(amount, decimals = 9) {
        return exports.SolanaUtils.formatTokenAmount(amount, decimals);
    }
    async generatePerformanceReport() {
        return exports.SolanaUtils.generatePerformanceReport(this.connection);
    }
    async runDiagnostics() {
        console.log('🔍 Running Sniper Bot Diagnostics...\n');
        const results = await exports.SolanaUtils.runDiagnostics(this.connection);
        console.log('1. Checking RPC Health...');
        console.log(`   RPC Health: ${results.rpcHealth.healthy ? '✅ Healthy' : '❌ Unhealthy'} (${results.rpcHealth.responseTime}ms)\n`);
        console.log('2. Performance Report:');
        console.log('   ', JSON.stringify(results.performanceReport, null, 2), '\n');
        console.log('🏁 Diagnostics Complete!');
    }
    // Deprecated methods removed in favor of pure functions
    async monitorToken(tokenMint, duration = 60000) {
        console.warn('monitorToken is deprecated and has been removed for stateless architecture');
    }
}
exports.SniperBotUtils = SniperBotUtils;
