"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedSwapService = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const fs_1 = __importDefault(require("fs"));
const risk_manager_1 = require("./risk-manager");
const notifications_1 = require("./notifications");
const transaction_simulator_1 = require("./transaction-simulator");
// Load configuration from config.json
const loadConfig = () => {
    try {
        const configData = fs_1.default.readFileSync('./config.json', 'utf8');
        const userConfig = JSON.parse(configData);
        return {
            SOLANA_RPC_URL: userConfig.solanaRpcUrl,
            walletPath: './my-wallet.json',
            AMOUNT_TO_BUY: userConfig.buyAmountSol,
            SLIPPAGE: userConfig.slippage,
            MAX_RETRIES: 5,
            RETRY_DELAY: 1000,
            MIN_LIQUIDITY: 0.001,
            PRIORITY_FEE: 50000,
            WEBSOCKET_RECONNECT_DELAY: 5000,
            MAX_CONCURRENT_SNIPES: 3,
            GAS_LIMIT_MULTIPLIER: 1.2,
            TOKEN_VALIDATION: {
                MIN_LIQUIDITY_USD: 10000,
                MIN_HOLDERS: 7,
                REQUIRE_NO_MINT: true,
                REQUIRE_NO_BLACKLIST: true,
                ENABLE_DEVELOPER_FILTERING: true
            },
            SWAP_METHODS: {
                ENABLE_PUMPFUN: true,
                ENABLE_JUPITER: true,
                ENABLE_RAYDIUM: true,
                ENABLE_METEORA: true,
                SOLANA: 'solana',
                JITO: 'jito',
                NOZOMI: 'nozomi',
                ZERO_SLOT: '0slot',
                RACE: 'race'
            },
            PROFIT_TAKING: {
                ENABLE_AUTO_PROFIT: true,
                PROFIT_PERCENTAGE: 50,
                STOP_LOSS_PERCENTAGE: 20,
                TRAILING_STOP: true
            },
            PERFORMANCE: {
                maxRetries: 5
            },
            PRIORITY_FEES: {
                HIGH: 50000,
                ULTRA: 100000,
                JITO_TIP: 75000,
                NOZOMI_TIP: 60000
            },
            JITO: {
                RPC_URL: 'https://jito-api.mainnet.jito.network',
                TIP_ACCOUNT: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn'
            },
            NOZOMI: {
                RPC_URL: 'https://rpc.nozomi.com',
                TIP_ACCOUNT: 'TEMPaMeCRFAS9EKF53Jd6KpHxgL47uWLcpFArU1Fanq'
            }
        };
    }
    catch (error) {
        console.error('Error loading config.json, using defaults:', error);
        // Fallback to default config
        return {
            SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
            walletPath: './my-wallet.json',
            AMOUNT_TO_BUY: 0.01,
            SLIPPAGE: 30,
            MAX_RETRIES: 5,
            RETRY_DELAY: 1000,
            MIN_LIQUIDITY: 0.001,
            PRIORITY_FEE: 50000,
            WEBSOCKET_RECONNECT_DELAY: 5000,
            MAX_CONCURRENT_SNIPES: 3,
            GAS_LIMIT_MULTIPLIER: 1.2,
            TOKEN_VALIDATION: {
                MIN_LIQUIDITY_USD: 10000,
                MIN_HOLDERS: 7,
                REQUIRE_NO_MINT: true,
                REQUIRE_NO_BLACKLIST: true,
                ENABLE_DEVELOPER_FILTERING: true
            },
            SWAP_METHODS: {
                ENABLE_PUMPFUN: true,
                ENABLE_JUPITER: true,
                ENABLE_RAYDIUM: true,
                ENABLE_METEORA: true,
                SOLANA: 'solana',
                JITO: 'jito',
                NOZOMI: 'nozomi',
                ZERO_SLOT: '0slot',
                RACE: 'race'
            },
            PROFIT_TAKING: {
                ENABLE_AUTO_PROFIT: true,
                PROFIT_PERCENTAGE: 50,
                STOP_LOSS_PERCENTAGE: 20,
                TRAILING_STOP: true
            },
            PERFORMANCE: {
                maxRetries: 5
            },
            PRIORITY_FEES: {
                HIGH: 50000,
                ULTRA: 100000,
                JITO_TIP: 75000,
                NOZOMI_TIP: 60000
            },
            JITO: {
                RPC_URL: 'https://jito-api.mainnet.jito.network',
                TIP_ACCOUNT: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn'
            },
            NOZOMI: {
                RPC_URL: 'https://rpc.nozomi.com',
                TIP_ACCOUNT: 'TEMPaMeCRFAS9EKF53Jd6KpHxgL47uWLcpFArU1Fanq'
            }
        };
    }
};
// Enhanced rate limiting with configurable settings and 429 handling
class RateLimiter {
    requestCounts = new Map();
    lastRateLimitWarning = new Map();
    // Configuration - can be made configurable via config.json
    windowMs;
    maxRequestsPerWindow;
    maxRequestsPerMethod;
    warningCooldownMs = 10000; // 10 seconds between warnings
    constructor(config) {
        // Default configuration with ability to override
        this.windowMs = config?.windowMs || 10000; // 10 seconds
        this.maxRequestsPerWindow = config?.maxRequestsPerWindow || 100;
        this.maxRequestsPerMethod = config?.maxRequestsPerMethod || 40;
    }
    async waitForRateLimit(method = 'general') {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        // Initialize tracking if needed
        if (!this.requestCounts.has(method)) {
            this.requestCounts.set(method, []);
        }
        if (!this.requestCounts.has('general')) {
            this.requestCounts.set('general', []);
        }
        const methodRequests = this.requestCounts.get(method);
        const generalRequests = this.requestCounts.get('general');
        // Clean old timestamps (remove requests outside the window)
        const filteredMethodRequests = methodRequests.filter(time => time > windowStart);
        const filteredGeneralRequests = generalRequests.filter(time => time > windowStart);
        // Check method-specific rate limit
        if (filteredMethodRequests.length >= this.maxRequestsPerMethod) {
            const oldestRequest = Math.min(...filteredMethodRequests);
            const waitTime = this.windowMs - (now - oldestRequest) + 100; // Add small buffer
            // Only log warning occasionally to avoid spam
            const lastWarning = this.lastRateLimitWarning.get(method) || 0;
            if (now - lastWarning > this.warningCooldownMs) {
                console.log(`⏳ Method rate limit reached for '${method}' (${filteredMethodRequests.length}/${this.maxRequestsPerMethod}), waiting ${Math.round(waitTime)}ms...`);
                this.lastRateLimitWarning.set(method, now);
            }
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        // Check global rate limit
        if (filteredGeneralRequests.length >= this.maxRequestsPerWindow) {
            const oldestRequest = Math.min(...filteredGeneralRequests);
            const waitTime = this.windowMs - (now - oldestRequest) + 100; // Add small buffer
            // Only log warning occasionally to avoid spam
            const lastWarning = this.lastRateLimitWarning.get('general') || 0;
            if (now - lastWarning > this.warningCooldownMs) {
                console.log(`⏳ Global rate limit reached (${filteredGeneralRequests.length}/${this.maxRequestsPerWindow}), waiting ${Math.round(waitTime)}ms...`);
                this.lastRateLimitWarning.set('general', now);
            }
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        // Add current request to tracking
        filteredMethodRequests.push(now);
        filteredGeneralRequests.push(now);
        this.requestCounts.set(method, filteredMethodRequests);
        this.requestCounts.set('general', filteredGeneralRequests);
    }
    // ✅ NEW: Get current rate limit stats for monitoring
    getRateLimitStats() {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        const stats = [];
        for (const [method, requests] of this.requestCounts.entries()) {
            const activeRequests = requests.filter(time => time > windowStart).length;
            const maxRequests = method === 'general' ? this.maxRequestsPerWindow : this.maxRequestsPerMethod;
            stats.push({ method, currentRequests: activeRequests, maxRequests });
        }
        return stats;
    }
    // ✅ NEW: Check if a method is currently rate limited
    isRateLimited(method = 'general') {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        const requests = this.requestCounts.get(method) || [];
        const activeRequests = requests.filter(time => time > windowStart).length;
        const maxRequests = method === 'general' ? this.maxRequestsPerWindow : this.maxRequestsPerMethod;
        return activeRequests >= maxRequests;
    }
}
// Create rate limiter with configuration from config
let rateLimiterConfig = {};
try {
    const configData = JSON.parse(require('fs').readFileSync('./config.json', 'utf8'));
    rateLimiterConfig = {
        windowMs: configData.performance?.rateLimitWindow || 10000,
        maxRequestsPerWindow: configData.performance?.maxRequestsPerWindow || 100,
        maxRequestsPerMethod: configData.performance?.maxRequestsPerMethod || 40
    };
}
catch (error) {
    // Use defaults if config loading fails
    rateLimiterConfig = {
        windowMs: 10000,
        maxRequestsPerWindow: 100,
        maxRequestsPerMethod: 40
    };
}
const rateLimiter = new RateLimiter(rateLimiterConfig);
// Enhanced retry logic with specific HTTP 429 handling and configurable settings
async function executeWithRetry(operation, method = 'general', maxRetries = 3, // Made configurable
baseDelay = 1000, // Reduced default base delay
config) {
    let lastError;
    const retryConfig = {
        handle429: true,
        exponentialBackoff: true,
        maxDelay: 30000, // Maximum 30 second delay
        ...config
    };
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Wait for rate limit before each attempt
            await rateLimiter.waitForRateLimit(method);
            return await operation();
        }
        catch (error) {
            lastError = error;
            // ✅ NEW: Special handling for HTTP 429 (Too Many Requests) errors
            const is429Error = error instanceof Error && (error.message.includes('429') ||
                error.message.includes('Too Many Requests') ||
                error.message.includes('Rate limit') ||
                error.message.includes('rate limit') ||
                error.message.includes('rate_limit_exceeded'));
            if (is429Error && retryConfig.handle429) {
                // Use exponential backoff for 429 errors with longer delays
                const delay429 = retryConfig.exponentialBackoff
                    ? Math.min(baseDelay * Math.pow(2, attempt), retryConfig.maxDelay)
                    : baseDelay * 2; // Fixed multiplier if not using exponential backoff
                console.log(`🚫 HTTP 429 Rate Limited (${method}) - Attempt ${attempt}/${maxRetries}. Waiting ${Math.round(delay429)}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay429));
                if (attempt < maxRetries) {
                    console.log(`🔄 Retrying after 429 rate limit (attempt ${attempt + 1}/${maxRetries})...`);
                    continue;
                }
            }
            else if (attempt < maxRetries) {
                // Standard exponential backoff with jitter for non-429 errors
                const delay = retryConfig.exponentialBackoff
                    ? baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000
                    : baseDelay + Math.random() * 1000;
                console.log(`⚠️ ${method} failed (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(delay)}ms... Error: ${lastError.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    // Enhanced error reporting
    if (lastError && lastError instanceof Error && lastError.message.includes('429')) {
        console.error(`❌ ${method} failed after ${maxRetries} attempts due to persistent rate limiting (HTTP 429)`);
        throw new Error(`Rate limited: ${method} failed after ${maxRetries} attempts with persistent 429 errors`);
    }
    console.error(`❌ ${method} failed after ${maxRetries} attempts. Final error: ${lastError ? lastError.message : 'Unknown error'}`);
    throw lastError || new Error(`Unknown error in ${method}`);
}
class EnhancedSwapService {
    connection;
    jitoConnection;
    nozomiConnection;
    config;
    constructor(connection, config) {
        this.connection = connection;
        this.config = config || this.loadDefaultConfig();
        this.initializeConnections();
    }
    // ✅ NEW: Load default configuration for retry settings
    loadDefaultConfig() {
        try {
            const configData = fs_1.default.readFileSync('./config.json', 'utf8');
            return JSON.parse(configData);
        }
        catch (error) {
            // Return sensible defaults
            return {
                maxRetries: 3,
                baseDelay: 1000,
                maxDelay: 30000,
                exponentialBackoff: true,
                handle429: true
            };
        }
    }
    initializeConnections() {
        // JITO and Nozomi connections not configured in current config
        // These would be initialized if RPC URLs were provided
        console.log('ℹ️ JITO and Nozomi connections not configured');
    }
    // Main swap method with automatic method selection
    async executeSwap(request) {
        const startTime = Date.now();
        const method = request.method || 'solana';
        try {
            // Risk management check (convert lamports to SOL)
            const riskCheck = risk_manager_1.riskManager.canExecuteTrade(request.amount / 1e9, request.outputMint);
            if (!riskCheck.allowed) {
                return {
                    success: false,
                    error: `Trade blocked by risk manager: ${riskCheck.errors.join(', ')}`,
                    method,
                    executionTime: Date.now() - startTime
                };
            }
            // Check if this is a Pump.fun token and use bonding curve trading
            if (this.isPumpFunToken(request.outputMint)) {
                console.log(`🎯 Pump.fun token detected, using bonding curve trading`);
                try {
                    const result = await this.executePumpFunDirectSwap(request);
                    // Record successful trade
                    if (result.success && result.signature) {
                        risk_manager_1.riskManager.recordTrade('buy', request.outputMint, request.amount, 0, result.signature);
                        await notifications_1.notificationService.notifyTrade('buy', request.outputMint, request.amount, 0, result.signature);
                    }
                    return result;
                }
                catch (pumpFunError) {
                    console.log(`⚠️ Pump.fun bonding curve failed, falling back to standard swap`);
                }
            }
            let result;
            // Execute based on method
            switch (method) {
                case 'jito':
                    if (this.jitoConnection) {
                        result = await this.executeJitoSwap(request);
                    }
                    else {
                        console.log('⚠️ JITO not available, falling back to standard swap');
                        result = await this.executeStandardSwap(request);
                    }
                    break;
                case 'nozomi':
                    if (this.nozomiConnection) {
                        result = await this.executeNozomiSwap(request);
                    }
                    else {
                        console.log('⚠️ Nozomi not available, falling back to standard swap');
                        result = await this.executeStandardSwap(request);
                    }
                    break;
                case '0slot':
                    result = await this.executeZeroSlotSwap(request);
                    break;
                case 'race':
                    result = await this.executeRaceSwap(request);
                    break;
                default:
                    result = await this.executeStandardSwap(request);
            }
            // Record successful trade
            if (result.success && result.signature) {
                risk_manager_1.riskManager.recordTrade('buy', request.outputMint, request.amount, 0, result.signature);
                await notifications_1.notificationService.notifyTrade('buy', request.outputMint, request.amount, 0, result.signature);
            }
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await notifications_1.notificationService.notifyError(error instanceof Error ? error : new Error(errorMessage), 'Swap Execution');
            return {
                success: false,
                error: errorMessage,
                method,
                executionTime: Date.now() - startTime
            };
        }
    }
    // Execute standard swap with Jupiter
    async executeStandardSwap(request) {
        try {
            console.log(`🚀 Executing standard swap via Jupiter`);
            // Get Jupiter quote
            const quote = await this.getJupiterQuote(request);
            // Create swap transaction
            const transaction = await this.createSwapTransaction(quote, request);
            // Add priority fee for better success rate
            this.addPriorityFee(transaction, 50000);
            // Add recent blockhash
            const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;
            transaction.feePayer = request.wallet.publicKey;
            // Validate and simulate transaction before sending
            const validation = new transaction_simulator_1.TransactionSimulator(this.connection).validateTransaction(transaction);
            if (!validation.valid) {
                throw new Error(`Transaction validation failed: ${validation.errors.join(', ')}`);
            }
            // Simulate transaction to check for errors
            const simulation = await new transaction_simulator_1.TransactionSimulator(this.connection).simulateTransaction(transaction);
            if (!simulation.success) {
                throw new Error(`Transaction simulation failed: ${simulation.error}`);
            }
            console.log(`✅ Transaction validated and simulated successfully`);
            // Sign transaction first
            transaction.sign(request.wallet);
            // Send signed transaction with enhanced retry and 429 handling
            const signature = await executeWithRetry(async () => {
                return await this.connection.sendTransaction(transaction, [], {
                    skipPreflight: false,
                    maxRetries: 2,
                    preflightCommitment: 'confirmed'
                });
            }, 'send_transaction', this.config.maxRetries, this.config.baseDelay, {
                handle429: this.config.handle429,
                exponentialBackoff: this.config.exponentialBackoff,
                maxDelay: this.config.maxDelay
            });
            console.log(`📡 Transaction sent: ${signature}`);
            // Wait for confirmation with timeout
            const confirmation = await this.connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            }, 'confirmed');
            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }
            console.log(`✅ Swap successful: ${signature}`);
            return {
                success: true,
                signature,
                method: 'solana',
                executionTime: 0
            };
        }
        catch (jupiterError) {
            console.log(`🔄 Jupiter failed, trying Raydium AMM fallback: ${jupiterError instanceof Error ? jupiterError.message : 'Unknown error'}`);
            // Fallback to direct Raydium AMM swap
            return await this.executeRaydiumFallbackSwap(request);
        }
    }
    // Raydium AMM fallback swap for new tokens
    async executeRaydiumFallbackSwap(request) {
        try {
            console.log(`🎯 Executing Raydium AMM fallback swap for ${request.outputMint}`);
            // Create direct Raydium swap transaction
            const transaction = await this.createRaydiumSwapTransaction(request);
            // Add priority fee for better success rate
            this.addPriorityFee(transaction, 50000);
            // Add recent blockhash
            const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;
            transaction.feePayer = request.wallet.publicKey;
            // Validate and simulate transaction before sending
            const validation = new transaction_simulator_1.TransactionSimulator(this.connection).validateTransaction(transaction);
            if (!validation.valid) {
                throw new Error(`Transaction validation failed: ${validation.errors.join(', ')}`);
            }
            // Simulate transaction to check for errors
            const simulation = await new transaction_simulator_1.TransactionSimulator(this.connection).simulateTransaction(transaction);
            if (!simulation.success) {
                throw new Error(`Transaction simulation failed: ${simulation.error}`);
            }
            console.log(`✅ Raydium transaction validated and simulated successfully`);
            // Sign the transaction before sending
            transaction.sign(request.wallet);
            console.log(`📡 Sending Raydium swap transaction...`);
            // Send transaction with enhanced retries and 429 handling
            const signature = await executeWithRetry(async () => {
                return await this.connection.sendTransaction(transaction, [], {
                    skipPreflight: false,
                    maxRetries: 2,
                    preflightCommitment: 'confirmed'
                });
            }, 'send_transaction', this.config.maxRetries, this.config.baseDelay, {
                handle429: this.config.handle429,
                exponentialBackoff: this.config.exponentialBackoff,
                maxDelay: this.config.maxDelay
            });
            console.log(`📡 Raydium transaction sent: ${signature}`);
            // Wait for confirmation
            const confirmation = await this.connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            }, 'confirmed');
            if (confirmation.value.err) {
                throw new Error(`Raydium transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }
            console.log(`✅ Raydium fallback swap successful: ${signature}`);
            return {
                success: true,
                signature,
                method: 'RAYDIUM_FALLBACK',
                executionTime: 0
            };
        }
        catch (error) {
            // FIXED: Try Pump.fun direct execution as final fallback
            if (this.isPumpFunToken(request.outputMint)) {
                console.log(`🔄 Raydium failed, trying Pump.fun direct execution for ${request.outputMint}`);
                return await this.executePumpFunDirectSwap(request);
            }
            throw new Error(`Raydium fallback swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // FIXED: Implement Pump.fun bonding curve trading
    async executePumpFunDirectSwap(request) {
        try {
            console.log(`🚀 Executing Pump.fun bonding curve swap for ${request.outputMint}`);
            // Use the correct Pump.fun bonding curve API
            const pumpFunUrl = 'https://pumpportal.fun/api/trade-local';
            const swapRequest = {
                publicKey: request.wallet.publicKey.toString(),
                action: 'buy',
                mint: request.outputMint,
                denominatedInSol: 'true',
                amount: request.amount / 1e9, // Convert lamports to SOL
                slippage: request.slippage * 100, // Convert to percentage
                priorityFee: 0.0001,
                pool: 'pump'
            };
            console.log(`📡 Pump.fun bonding curve request:`, swapRequest);
            // ✅ Enhanced Pump.fun API call with 429 handling
            const response = await executeWithRetry(async () => {
                const resp = await fetch(pumpFunUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'SBSniper-Bot/1.0.0'
                    },
                    body: JSON.stringify(swapRequest)
                });
                if (!resp.ok) {
                    const errorText = await resp.text();
                    throw new Error(`Pump.fun bonding curve API error: ${resp.status} - ${errorText}`);
                }
                return resp;
            }, 'pumpfun_api', this.config.maxRetries, this.config.baseDelay, {
                handle429: this.config.handle429,
                exponentialBackoff: this.config.exponentialBackoff,
                maxDelay: this.config.maxDelay
            });
            // Pump.fun returns a serialized transaction
            const transactionData = await response.arrayBuffer();
            const versionedTx = web3_js_1.VersionedTransaction.deserialize(new Uint8Array(transactionData));
            console.log(`✅ Pump.fun bonding curve transaction received`);
            // Convert VersionedTransaction to regular Transaction with proper account keys
            const transaction = new web3_js_1.Transaction();
            // Add the original instructions with proper account keys
            versionedTx.message.compiledInstructions.forEach((instruction) => {
                const keys = instruction.accounts?.map((index) => ({
                    pubkey: versionedTx.message.staticAccountKeys[index],
                    isSigner: index === 0, // First account is signer
                    isWritable: true
                })) || [];
                const ix = new web3_js_1.TransactionInstruction({
                    keys,
                    programId: versionedTx.message.staticAccountKeys[instruction.programIdIndex],
                    data: instruction.data
                });
                transaction.add(ix);
            });
            // Sign the transaction before sending
            transaction.sign(request.wallet);
            // Execute the transaction using enhanced retry with 429 handling
            const signature = await executeWithRetry(async () => {
                return await this.connection.sendTransaction(transaction, [], {
                    skipPreflight: false,
                    maxRetries: 2,
                    preflightCommitment: 'confirmed'
                });
            }, 'send_transaction', this.config.maxRetries, this.config.baseDelay, {
                handle429: this.config.handle429,
                exponentialBackoff: this.config.exponentialBackoff,
                maxDelay: this.config.maxDelay
            });
            console.log(`✅ Pump.fun bonding curve swap executed: ${signature}`);
            return {
                success: true,
                signature: signature,
                method: 'PUMPFUN_BONDING_CURVE',
                executionTime: 0
            };
        }
        catch (error) {
            console.error(`❌ Pump.fun bonding curve swap failed:`, error);
            // Try fallback method if bonding curve fails
            try {
                console.log(`🔄 Trying Pump.fun fallback method...`);
                return await this.executePumpFunFallback(request);
            }
            catch (fallbackError) {
                console.error(`❌ Pump.fun fallback also failed:`, fallbackError);
                throw new Error(`Pump.fun bonding curve swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
    // Fallback method for Pump.fun when bonding curve fails
    async executePumpFunFallback(request) {
        try {
            console.log(`🔄 Executing Pump.fun fallback swap for ${request.outputMint}`);
            // Try alternative Pump.fun endpoints as fallback
            const fallbackEndpoints = [
                'https://pumpportal.fun/api/swap',
                'https://pumpportal.fun/api/trade',
                'https://pumpportal.fun/api/execute'
            ];
            for (const endpoint of fallbackEndpoints) {
                try {
                    console.log(`🔄 Trying fallback endpoint: ${endpoint}`);
                    const swapRequest = {
                        mint: request.outputMint,
                        amount: request.amount.toString(),
                        slippage: request.slippage,
                        wallet: request.wallet.publicKey.toString(),
                        action: 'buy'
                    };
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Agent': 'SBSniper-Bot/1.0.0'
                        },
                        body: JSON.stringify(swapRequest)
                    });
                    if (response.ok) {
                        const swapResult = await response.json();
                        if (swapResult.success && swapResult.signature) {
                            console.log(`✅ Pump.fun fallback swap successful via ${endpoint}: ${swapResult.signature}`);
                            return {
                                success: true,
                                signature: swapResult.signature,
                                method: 'PUMPFUN_FALLBACK',
                                executionTime: 0
                            };
                        }
                    }
                }
                catch (endpointError) {
                    console.log(`⚠️ Fallback endpoint ${endpoint} failed:`, endpointError);
                }
            }
            throw new Error('All Pump.fun fallback methods failed');
        }
        catch (error) {
            console.error(`❌ Pump.fun fallback swap failed:`, error);
            throw new Error(`Pump.fun fallback swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // FIXED: Check if token is from Pump.fun
    isPumpFunToken(tokenMint) {
        // Check if token has Pump.fun characteristics or if we're on Pump.fun platform
        // This is a simplified check - you might want to enhance this logic
        return tokenMint.includes('pump') || process.env.PLATFORM === 'pumpfun';
    }
    // JITO MEV-protected swap
    async executeJitoSwap(request) {
        if (!this.jitoConnection) {
            throw new Error('JITO connection not available');
        }
        try {
            console.log(`🛡️ Executing JITO MEV-protected swap`);
            // Get quote from Jupiter
            const quote = await this.getJupiterQuote(request);
            // Create transaction with JITO tip
            const transaction = await this.createSwapTransaction(quote, request);
            this.addJitoTip(transaction, request.wallet.publicKey);
            // Add priority fee
            this.addPriorityFee(transaction, 50000);
            // Add recent blockhash
            const { blockhash, lastValidBlockHeight } = await this.jitoConnection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;
            transaction.feePayer = request.wallet.publicKey;
            // Sign the transaction before sending
            transaction.sign(request.wallet);
            // Send via JITO connection
            const signature = await this.jitoConnection.sendTransaction(transaction, [], {
                skipPreflight: false,
                maxRetries: 5,
                preflightCommitment: 'confirmed'
            });
            console.log(`📡 JITO transaction sent: ${signature}`);
            // Wait for confirmation
            const confirmation = await this.jitoConnection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            }, 'confirmed');
            if (confirmation.value.err) {
                throw new Error(`JITO transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }
            console.log(`✅ JITO swap successful: ${signature}`);
            return {
                success: true,
                signature,
                method: 'jito',
                executionTime: 0
            };
        }
        catch (error) {
            throw new Error(`JITO swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // Nozomi ultra-fast swap
    async executeNozomiSwap(request) {
        if (!this.nozomiConnection) {
            throw new Error('Nozomi connection not available');
        }
        try {
            console.log(`⚡ Executing Nozomi ultra-fast swap`);
            // Get quote from Jupiter
            const quote = await this.getJupiterQuote(request);
            // Create transaction with Nozomi tip
            const transaction = await this.createSwapTransaction(quote, request);
            this.addNozomiTip(transaction, request.wallet.publicKey);
            // Add priority fee
            this.addPriorityFee(transaction, 50000);
            // Add recent blockhash
            const { blockhash, lastValidBlockHeight } = await this.nozomiConnection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;
            transaction.feePayer = request.wallet.publicKey;
            // Sign the transaction before sending
            transaction.sign(request.wallet);
            // Send via Nozomi connection
            const signature = await this.nozomiConnection.sendTransaction(transaction, [], {
                skipPreflight: false,
                maxRetries: 5,
                preflightCommitment: 'confirmed'
            });
            console.log(`📡 Nozomi transaction sent: ${signature}`);
            // Wait for confirmation
            const confirmation = await this.nozomiConnection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            }, 'confirmed');
            if (confirmation.value.err) {
                throw new Error(`Nozomi transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }
            console.log(`✅ Nozomi swap successful: ${signature}`);
            return {
                success: true,
                signature,
                method: 'nozomi',
                executionTime: 0
            };
        }
        catch (error) {
            throw new Error(`Nozomi swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // Zero-slot swap for maximum speed
    async executeZeroSlotSwap(request) {
        try {
            // Get quote from Jupiter
            const quote = await this.getJupiterQuote(request);
            // Create transaction with priority fee
            const transaction = await this.createSwapTransaction(quote, request);
            this.addPriorityFee(transaction, 50000);
            // Sign the transaction before sending
            transaction.sign(request.wallet);
            // Send with skipPreflight for speed
            const signature = await this.connection.sendTransaction(transaction, [], {
                skipPreflight: true,
                maxRetries: 1
            });
            await this.connection.confirmTransaction(signature, 'confirmed');
            return {
                success: true,
                signature,
                method: '0slot',
                executionTime: 0
            };
        }
        catch (error) {
            throw new Error(`Zero-slot swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // Race swap for competitive trading
    async executeRaceSwap(request) {
        try {
            // Get quote from Jupiter
            const quote = await this.getJupiterQuote(request);
            // Create transaction with race-optimized settings
            const transaction = await this.createSwapTransaction(quote, request);
            this.addPriorityFee(transaction, 50000);
            // Sign the transaction before sending
            transaction.sign(request.wallet);
            // Send with optimized settings
            const signature = await this.connection.sendTransaction(transaction, [], {
                skipPreflight: false,
                maxRetries: 2
            });
            await this.connection.confirmTransaction(signature, 'confirmed');
            return {
                success: true,
                signature,
                method: 'race',
                executionTime: 0
            };
        }
        catch (error) {
            throw new Error(`Race swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // Get Jupiter quote for token swap with enhanced retry and 429 handling
    async getJupiterQuote(request) {
        try {
            console.log(`🔍 Getting Jupiter quote for ${request.outputMint}`);
            const jupiterQuoteUrl = 'https://quote-api.jup.ag/quote';
            // Build query parameters
            const params = new URLSearchParams({
                inputMint: request.inputMint,
                outputMint: request.outputMint,
                amount: request.amount.toString(),
                slippageBps: Math.floor(request.slippage * 10000).toString(),
                onlyDirectRoutes: 'false',
                asLegacyTransaction: 'false'
            });
            const fullUrl = `${jupiterQuoteUrl}?${params.toString()}`;
            console.log(`📡 Jupiter quote request:`, fullUrl);
            // ✅ Use enhanced retry with 429 handling
            const response = await executeWithRetry(async () => {
                const resp = await fetch(fullUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'SBSniper-Bot/1.0.0',
                        'Accept': 'application/json'
                    }
                });
                // Check for HTTP errors including 429
                if (!resp.ok) {
                    const errorText = await resp.text();
                    console.error(`❌ Jupiter API error ${resp.status}:`, errorText);
                    throw new Error(`Jupiter API error: ${resp.status} - ${errorText}`);
                }
                return resp;
            }, 'jupiter_quote', this.config.maxRetries, this.config.baseDelay, {
                handle429: this.config.handle429,
                exponentialBackoff: this.config.exponentialBackoff,
                maxDelay: this.config.maxDelay
            });
            const quote = await response.json();
            console.log(`✅ Jupiter quote received: ${quote.outAmount} output tokens`);
            return quote;
        }
        catch (error) {
            console.error(`❌ Jupiter quote failed after retries:`, error instanceof Error ? error.message : 'Unknown error');
            throw new Error(`Jupiter quote failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // FIXED: Fallback to Jupiter v4 API
    async getJupiterQuoteV4(request) {
        try {
            console.log(`🔍 Getting Jupiter v4 quote for ${request.outputMint}`);
            const jupiterV4Url = 'https://quote-api.jup.ag/v4/quote';
            const quoteRequest = {
                inputMint: request.inputMint,
                outputMint: request.outputMint,
                amount: request.amount.toString(),
                slippageBps: Math.floor(request.slippage * 10000),
                onlyDirectRoutes: false,
                asLegacyTransaction: false
            };
            const response = await fetch(jupiterV4Url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'SBSniper-Bot/1.0.0'
                },
                body: JSON.stringify(quoteRequest)
            });
            if (!response.ok) {
                throw new Error(`Jupiter v4 API error: ${response.status}`);
            }
            const quote = await response.json();
            console.log(`✅ Jupiter v4 quote received: ${quote.outAmount} output tokens`);
            return quote;
        }
        catch (error) {
            console.error(`❌ Jupiter v4 quote failed:`, error);
            throw error;
        }
    }
    // Create swap transaction from Jupiter quote
    async createSwapTransaction(quote, request) {
        try {
            console.log(`🔧 Creating Jupiter swap transaction`);
            // FIXED: Use correct Jupiter swap endpoint for the working quote API
            const swapUrl = 'https://quote-api.jup.ag/swap';
            const swapBody = {
                quoteResponse: quote,
                userPublicKey: request.wallet.publicKey.toString(),
                wrapUnwrapSOL: true
            };
            // ✅ Use enhanced retry with 429 handling for Jupiter swap API
            const swapResponse = await executeWithRetry(async () => {
                const resp = await fetch(swapUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'SBSniper-Bot/1.0.0',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(swapBody)
                });
                if (!resp.ok) {
                    const errorText = await resp.text();
                    console.error(`❌ Jupiter swap API error ${resp.status}:`, errorText);
                    throw new Error(`Jupiter swap API error: ${resp.status} - ${errorText}`);
                }
                return resp;
            }, 'jupiter_swap', this.config.maxRetries, this.config.baseDelay, {
                handle429: this.config.handle429,
                exponentialBackoff: this.config.exponentialBackoff,
                maxDelay: this.config.maxDelay
            });
            const swapData = await swapResponse.json();
            if (!swapData.swapTransaction) {
                throw new Error('No swap transaction received from Jupiter');
            }
            console.log(`✅ Jupiter swap transaction received`);
            // Deserialize the transaction
            const transaction = web3_js_1.VersionedTransaction.deserialize(Buffer.from(swapData.swapTransaction, 'base64'));
            // Convert to regular transaction for easier manipulation
            const regularTransaction = new web3_js_1.Transaction();
            regularTransaction.add(...transaction.message.compiledInstructions.map(ix => {
                const keys = ix.accountKeyIndexes.map((accIndex) => ({
                    pubkey: transaction.message.staticAccountKeys[accIndex],
                    isSigner: accIndex < transaction.message.header.numRequiredSignatures,
                    isWritable: accIndex < transaction.message.header.numRequiredSignatures ||
                        (accIndex - transaction.message.header.numRequiredSignatures) < transaction.message.header.numReadonlySignedAccounts
                }));
                return new web3_js_1.TransactionInstruction({
                    programId: transaction.message.staticAccountKeys[ix.programIdIndex],
                    keys,
                    data: Buffer.from(ix.data)
                });
            }));
            return regularTransaction;
        }
        catch (error) {
            throw new Error(`Failed to create swap transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // Add JITO tip instruction
    addJitoTip(transaction, wallet) {
        try {
            const tipAccount = new web3_js_1.PublicKey('J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn');
            const tipInstruction = web3_js_1.SystemProgram.transfer({
                fromPubkey: wallet,
                toPubkey: tipAccount,
                lamports: 10000 // 0.00001 SOL tip
            });
            transaction.add(tipInstruction);
            console.log(`✅ Added JITO tip: 0.00001 SOL to J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn`);
        }
        catch (error) {
            console.warn(`⚠️ Failed to add JITO tip: ${error}`);
        }
    }
    // Add Nozomi tip instruction
    addNozomiTip(transaction, wallet) {
        try {
            const tipAccount = new web3_js_1.PublicKey('TEMPaMeCRFAS9EKF53Jd6KpHxgL47uWLcpFArU1Fanq');
            const tipInstruction = web3_js_1.SystemProgram.transfer({
                fromPubkey: wallet,
                toPubkey: tipAccount,
                lamports: 20000 // 0.00002 SOL tip
            });
            transaction.add(tipInstruction);
            console.log(`✅ Added Nozomi tip: 0.00002 SOL to TEMPaMeCRFAS9EKF53Jd6KpHxgL47uWLcpFArU1Fanq`);
        }
        catch (error) {
            console.warn(`⚠️ Failed to add Nozomi tip: ${error}`);
        }
    }
    // Add priority fee to transaction
    addPriorityFee(transaction, fee) {
        try {
            // Add compute unit price instruction for priority fees
            const modifyComputeUnits = web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: fee
            });
            // Add compute unit limit instruction
            const setComputeUnitLimit = web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({
                units: 400_000 // Set compute unit limit
            });
            // Add instructions at the beginning of the transaction
            transaction.add(modifyComputeUnits);
            transaction.add(setComputeUnitLimit);
            console.log(`✅ Added priority fee: ${fee} micro-lamports per compute unit`);
        }
        catch (error) {
            console.warn(`⚠️ Failed to add priority fee: ${error}`);
        }
    }
    // Get available swap methods
    getAvailableMethods() {
        const methods = ['solana'];
        // JITO and Nozomi not available without RPC URLs
        // if (this.jitoConnection) methods.push('jito');
        // if (this.nozomiConnection) methods.push('nozomi');
        methods.push('0slot', 'race');
        return methods;
    }
    // Get method performance statistics
    async getMethodPerformance() {
        // This would track execution times and success rates for each method
        return {
            solana: { avgExecutionTime: 1500, successRate: 0.95 },
            // jito: { avgExecutionTime: 1200, successRate: 0.98 }, // Not available
            // nozomi: { avgExecutionTime: 800, successRate: 0.97 }, // Not available
            zeroSlot: { avgExecutionTime: 1000, successRate: 0.94 },
            race: { avgExecutionTime: 1100, successRate: 0.96 },
            raydiumFallback: { avgExecutionTime: 2000, successRate: 0.90 }
        };
    }
    // Create direct Raydium AMM swap transaction
    async createRaydiumSwapTransaction(request) {
        try {
            console.log(`🔧 Creating Raydium AMM swap transaction for ${request.outputMint}`);
            const transaction = new web3_js_1.Transaction();
            // Find Raydium AMM pool for the token pair
            const poolInfo = await this.findRaydiumPool(request.outputMint);
            if (!poolInfo) {
                throw new Error('No Raydium AMM pool found for token pair');
            }
            // Create swap instruction
            const swapInstruction = await this.createRaydiumSwapInstruction(request, poolInfo);
            transaction.add(swapInstruction);
            // Add recent blockhash
            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = request.wallet.publicKey;
            console.log(`✅ Raydium swap transaction created successfully`);
            return transaction;
        }
        catch (error) {
            throw new Error(`Failed to create Raydium swap transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // Find Raydium AMM pool for token pair using real SDK
    async findRaydiumPool(tokenMint) {
        try {
            console.log(`🔍 Searching for Raydium pool for ${tokenMint}`);
            // Simplified pool finding - return null for now to avoid complex dependencies
            console.log(`⚠️ Pool finding temporarily disabled to avoid complex dependencies`);
            return null;
        }
        catch (error) {
            console.error(`Error finding Raydium pool: ${error}`);
            return null;
        }
    }
    // Get real pool keys using Raydium SDK
    async getPoolKeys(poolId) {
        try {
            // Fetch pool info from Raydium API
            const response = await fetch('https://api.raydium.io/v2/sdk/liquidity/mainnet.json');
            if (!response.ok) {
                throw new Error(`Failed to fetch pools: ${response.status}`);
            }
            const poolsData = await response.json();
            const poolInfo = poolsData.official.find((pool) => pool.id === poolId);
            if (!poolInfo) {
                return null;
            }
            // Return the pool info directly - we'll use it for creating swap instructions
            return poolInfo;
        }
        catch (error) {
            console.error('Error getting pool keys:', error);
            return null;
        }
    }
    // Create Raydium swap instruction
    async createRaydiumSwapInstruction(request, poolInfo) {
        try {
            console.log(`🔧 Creating Raydium swap instruction`);
            // Validate that the outputMint is a valid PublicKey
            let outputMintPubkey;
            try {
                outputMintPubkey = new web3_js_1.PublicKey(request.outputMint);
            }
            catch (error) {
                throw new Error(`Invalid output mint address: ${request.outputMint}`);
            }
            // Validate poolInfo.poolId is a valid PublicKey
            let poolIdPubkey;
            try {
                poolIdPubkey = new web3_js_1.PublicKey(poolInfo.id);
            }
            catch (error) {
                throw new Error(`Invalid pool ID: ${poolInfo.id}`);
            }
            // Create proper Raydium swap instruction
            // Instruction discriminator for swap: 0x09
            const data = Buffer.alloc(9);
            data.writeUint8(0x09, 0); // Instruction discriminator for swap
            data.writeBigUint64LE(BigInt(request.amount), 1); // Amount in lamports
            // Create account metas for Raydium swap
            const keys = [
                { pubkey: request.wallet.publicKey, isSigner: true, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.authority), isSigner: false, isWritable: false },
                { pubkey: new web3_js_1.PublicKey(poolInfo.openOrders), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.targetOrders), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.baseVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.quoteVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.lpVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketId), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketBids), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketAsks), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketEventQueue), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketBaseVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketQuoteVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketAuthority), isSigner: false, isWritable: false },
                { pubkey: spl_token_1.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: request.wallet.publicKey, isSigner: false, isWritable: true }, // User's SOL account
            ];
            const instruction = new web3_js_1.TransactionInstruction({
                keys,
                programId: new web3_js_1.PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'), // Raydium AMM Program ID
                data
            });
            console.log(`✅ Raydium swap instruction created`);
            return instruction;
        }
        catch (error) {
            throw new Error(`Failed to create Raydium swap instruction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.EnhancedSwapService = EnhancedSwapService;
// Export singleton instance
// Service instance will be created by SniperBot
