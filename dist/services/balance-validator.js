"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBalanceValidator = exports.BalanceValidator = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const structured_logger_1 = require("./structured-logger");
const retry_service_1 = require("./retry-service");
/**
 * Balance validation service to check issuer and token balances before trading
 */
class BalanceValidator {
    connection;
    cache = new Map();
    cacheTimeout = 30000; // 30 seconds
    constructor(connection) {
        this.connection = connection;
    }
    /**
     * Validate issuer balance before allowing trade
     */
    async validateIssuerBalance(issuerAddress, tokenMint, minSOLBalance = 0.001, minTokenBalance = 0) {
        const warnings = [];
        const recommendations = [];
        let riskLevel = 'low';
        try {
            structured_logger_1.logger.info(`🔍 Validating issuer balance: ${issuerAddress}`);
            // Check SOL balance
            const solBalance = await this.getSOLBalance(issuerAddress);
            // Check token balance if token mint provided
            let tokenBalance = 0;
            if (tokenMint) {
                tokenBalance = await this.getTokenBalance(issuerAddress, tokenMint);
            }
            // Validate SOL balance
            if (solBalance === 0) {
                warnings.push('Issuer has zero SOL balance');
                recommendations.push('Avoid trading with zero-balance issuers');
                riskLevel = 'high';
            }
            else if (solBalance < minSOLBalance) {
                warnings.push(`Issuer SOL balance (${solBalance}) below minimum (${minSOLBalance})`);
                recommendations.push('Consider increasing minimum balance threshold');
                riskLevel = 'medium';
            }
            // Validate token balance
            if (tokenMint && tokenBalance < minTokenBalance) {
                warnings.push(`Issuer token balance (${tokenBalance}) below minimum (${minTokenBalance})`);
                riskLevel = Math.max(riskLevel === 'low' ? 1 : riskLevel === 'medium' ? 2 : 3, 2) === 2 ? 'medium' : 'high';
            }
            // Additional risk factors
            if (solBalance > 0 && solBalance < 0.0001) {
                warnings.push('Issuer has very low SOL balance - may indicate dust account');
                riskLevel = 'medium';
            }
            // Check for suspicious patterns
            if (this.isSuspiciousBalance(solBalance, tokenBalance)) {
                warnings.push('Balance pattern suggests potential risk');
                recommendations.push('Manual review recommended');
                riskLevel = 'high';
            }
            const isValid = warnings.length === 0 || riskLevel !== 'high';
            const result = {
                issuer: issuerAddress,
                tokenMint,
                solBalance,
                tokenBalance,
                isValid,
                riskLevel,
                warnings,
                recommendations
            };
            // Log result
            if (isValid) {
                structured_logger_1.logger.info(`✅ Issuer validation passed`, {
                    issuer: issuerAddress,
                    solBalance,
                    tokenBalance,
                    riskLevel
                });
            }
            else {
                structured_logger_1.logger.warn(`❌ Issuer validation failed`, {
                    issuer: issuerAddress,
                    solBalance,
                    tokenBalance,
                    riskLevel,
                    warnings
                });
            }
            return result;
        }
        catch (error) {
            structured_logger_1.logger.error('Error validating issuer balance', {
                issuer: issuerAddress,
                tokenMint,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                issuer: issuerAddress,
                tokenMint,
                solBalance: 0,
                tokenBalance: 0,
                isValid: false,
                riskLevel: 'high',
                warnings: ['Failed to validate issuer balance'],
                recommendations: ['Manual verification required']
            };
        }
    }
    /**
     * Get SOL balance for address
     */
    async getSOLBalance(address) {
        const cacheKey = `sol:${address}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
            return cached.balance;
        }
        try {
            const publicKey = new web3_js_1.PublicKey(address);
            const balance = await retry_service_1.retryService.executeWithRetry(() => this.connection.getBalance(publicKey), { apiName: 'solana', operation: 'balance-check' });
            const balanceSOL = balance / web3_js_1.LAMPORTS_PER_SOL;
            const result = {
                address,
                balance: balanceSOL,
                balanceSOL,
                valid: true
            };
            this.cacheResult(cacheKey, result);
            return balanceSOL;
        }
        catch (error) {
            structured_logger_1.logger.error('Error getting SOL balance', {
                address,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return 0;
        }
    }
    /**
     * Get token balance for address
     */
    async getTokenBalance(address, tokenMint) {
        const cacheKey = `token:${address}:${tokenMint}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
            return cached.tokenBalance || 0;
        }
        try {
            const walletPublicKey = new web3_js_1.PublicKey(address);
            const tokenPublicKey = new web3_js_1.PublicKey(tokenMint);
            // Get associated token account
            const associatedTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(tokenPublicKey, walletPublicKey);
            // Check if account exists and get balance
            const accountInfo = await retry_service_1.retryService.executeWithRetry(() => this.connection.getAccountInfo(associatedTokenAccount), { apiName: 'solana', operation: 'token-balance-check' });
            if (!accountInfo) {
                // Account doesn't exist, balance is 0
                const result = {
                    address,
                    balance: 0,
                    tokenBalance: 0,
                    valid: true,
                    reason: 'Token account does not exist'
                };
                this.cacheResult(cacheKey, result);
                return 0;
            }
            // Parse token account to get balance
            const accountData = await retry_service_1.retryService.executeWithRetry(() => (0, spl_token_1.getAccount)(this.connection, associatedTokenAccount), { apiName: 'solana', operation: 'token-account-data' });
            const tokenBalance = Number(accountData.amount);
            const result = {
                address,
                balance: tokenBalance,
                tokenBalance,
                valid: true
            };
            this.cacheResult(cacheKey, result);
            return tokenBalance;
        }
        catch (error) {
            structured_logger_1.logger.error('Error getting token balance', {
                address,
                tokenMint,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            const result = {
                address,
                balance: 0,
                tokenBalance: 0,
                valid: false,
                reason: 'Failed to fetch token balance'
            };
            this.cacheResult(cacheKey, result);
            return 0;
        }
    }
    /**
     * Validate multiple addresses at once
     */
    async validateMultipleBalances(addresses, tokenMint, minSOLBalance = 0.001) {
        const valid = [];
        const invalid = [];
        await Promise.all(addresses.map(async (address) => {
            try {
                const result = await this.validateIssuerBalance(address, tokenMint || '', minSOLBalance);
                if (result.isValid) {
                    valid.push(address);
                }
                else {
                    invalid.push({
                        address,
                        reason: result.warnings.join(', ') || 'Validation failed'
                    });
                }
            }
            catch (error) {
                invalid.push({
                    address,
                    reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
                });
            }
        }));
        return { valid, invalid };
    }
    /**
     * Check if balance pattern is suspicious
     */
    isSuspiciousBalance(solBalance, tokenBalance) {
        // Define suspicious patterns
        const patterns = [
            // Exact zero balances (could be drained accounts)
            solBalance === 0 && tokenBalance === 0,
            // Very specific small amounts that might indicate automated behavior
            solBalance > 0 && solBalance < 0.00001,
            // Unusual balance ratios
            tokenBalance > 0 && solBalance === 0 // Has tokens but no SOL for fees
        ];
        return patterns.some(pattern => pattern);
    }
    /**
     * Get cached balance result
     */
    getCachedResult(key) {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.result;
        }
        return null;
    }
    /**
     * Cache balance result
     */
    cacheResult(key, result) {
        this.cache.set(key, {
            result,
            timestamp: Date.now()
        });
        // Clean up old cache entries
        if (this.cache.size > 1000) {
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            // Remove oldest 25% of entries
            const toRemove = Math.floor(entries.length * 0.25);
            for (let i = 0; i < toRemove; i++) {
                this.cache.delete(entries[i][0]);
            }
        }
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        structured_logger_1.logger.info('Balance validation cache cleared');
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        // This would require tracking hits/misses - simplified for now
        return {
            size: this.cache.size,
            hitRate: 0 // Placeholder
        };
    }
    /**
     * Pre-validate a list of addresses for better performance
     */
    async preValidateAddresses(addresses, tokenMint) {
        structured_logger_1.logger.info(`🔄 Pre-validating ${addresses.length} addresses`);
        // Batch validate in chunks to avoid overwhelming the RPC
        const chunkSize = 10;
        for (let i = 0; i < addresses.length; i += chunkSize) {
            const chunk = addresses.slice(i, i + chunkSize);
            await this.validateMultipleBalances(chunk, tokenMint);
            // Small delay to be respectful to RPC
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        structured_logger_1.logger.info(`✅ Pre-validation completed for ${addresses.length} addresses`);
    }
}
exports.BalanceValidator = BalanceValidator;
// Export a function to create validator instance
const createBalanceValidator = (connection) => new BalanceValidator(connection);
exports.createBalanceValidator = createBalanceValidator;
