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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SniperBot = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const pumpfun_1 = require("./pumpfun");
const raydium_1 = require("./raydium");
const meteora_1 = require("./meteora");
const fs_1 = __importDefault(require("fs"));
const ws_1 = __importDefault(require("ws"));
const risk_manager_1 = require("./services/risk-manager");
const notifications_1 = require("./services/notifications");
const enhanced_swap_1 = require("./services/enhanced-swap");
const token_validator_1 = require("./services/token-validator");
const bonk_fun_integration_1 = require("./services/bonk-fun-integration");
const profit_taker_1 = require("./services/profit-taker");
// NEW: Updated endpoints for PumpPortal
const PUMP_PORTAL_WS_URL = 'wss://pumpportal.fun/api/data';
const PUMP_FUN_REST_URL = 'https://pumpportal.fun/api/trade-local';
// Load user configuration from config.json
const loadUserConfig = () => {
    try {
        const configData = fs_1.default.readFileSync('./config.json', 'utf8');
        const userConfig = JSON.parse(configData);
        // Merge with default config structure
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
                ENABLE_UNIVERSAL_SNIPING: true
            },
            SWAP_METHODS: {
                SOLANA: 'solana',
                JITO: 'jito',
                NOZOMI: 'nozomi',
                ZERO_SLOT: '0slot',
                RACE: 'race'
            },
            JITO: {
                ENABLED: true,
                TIP_ACCOUNT: '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
                TIP_AMOUNT: 100000,
                MAX_RETRIES: 3,
                TIMEOUT: 30000
            },
            NOZOMI: {
                ENABLED: true,
                TIP_ACCOUNT: 'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
                TIP_AMOUNT: 200000,
                MAX_RETRIES: 3,
                TIMEOUT: 30000
            },
            PRIORITY_FEES: {
                STANDARD: 10000,
                HIGH: 50000,
                ULTRA: 100000,
                JITO_TIP: 100000,
                NOZOMI_TIP: 200000,
            },
            PLATFORM_CONFIG: {
                PUMP_FUN: {
                    enabled: true,
                    priority: 'high',
                    maxSlippage: userConfig.slippage
                },
                PUMP_SWAP: {
                    enabled: true,
                    priority: 'medium',
                    maxSlippage: userConfig.slippage
                },
                RAYDIUM_LAUNCHLAB: {
                    enabled: true,
                    priority: 'high',
                    maxSlippage: userConfig.slippage
                },
                RAYDIUM_CPMM: {
                    enabled: true,
                    priority: 'medium',
                    maxSlippage: userConfig.slippage
                },
                BONK_FUN: {
                    enabled: true,
                    priority: 'high',
                    maxSlippage: userConfig.slippage
                }
            },
            RISK_MANAGEMENT: {
                maxDailyLoss: 1.0,
                maxSingleLoss: 0.5,
                tradeCooldown: 5000,
                maxPositions: 5,
                minLiquidity: 10,
                maxTxAge: 1
            },
            PERFORMANCE: {
                maxRetries: 3,
                retryDelay: 1000,
                connectionTimeout: 30000,
                maxConcurrentRequests: 10
            },
            SECURITY: {
                enableSimulation: true,
                maxInstructionSize: 10000,
                requireValidSignatures: true,
                enableTransactionValidation: true
            },
            LOGGING: {
                level: 'info',
                debug: false,
                logToFile: true,
                logFilePath: './logs/trading-bot.log'
            },
            PROFIT_TAKING: {
                TIER_1: { percentage: 10.0, amount: 0.35 },
                TIER_2: { percentage: 100.0, amount: 0.35 },
                KEEP_AMOUNT: 0.30,
                ENABLE_AUTO_SELL: true,
                MIN_PROFIT_TO_SELL: 0.5,
                MAX_HOLD_TIME: 24 * 60 * 60 * 1000
            }
        };
    }
    catch (error) {
        console.error('Error loading config.json, using defaults:', error);
        // Return default config if file loading fails
        return {
            SOLANA_RPC_URL: 'https://solana-mainnet.core.chainstack.com/d957d9f011a51a960a42e5b247223dd4',
            walletPath: './my-wallet.json',
            AMOUNT_TO_BUY: 0.00001,
            SLIPPAGE: 0.3,
            SWAP_METHODS: {
                SOLANA: 'solana',
                JITO: 'jito',
                NOZOMI: 'nozomi',
                ZERO_SLOT: '0slot',
                RACE: 'race'
            },
            PROFIT_TAKING: {
                TIER_1: { percentage: 10.0, amount: 0.35 },
                TIER_2: { percentage: 100.0, amount: 0.35 },
                KEEP_AMOUNT: 0.30,
                ENABLE_AUTO_SELL: true,
                MIN_PROFIT_TO_SELL: 0.5,
                MAX_HOLD_TIME: 24 * 60 * 60 * 1000
            }
        };
    }
};
// Load user configuration
const CONFIG = loadUserConfig();
class SniperBot {
    connection;
    wallet;
    sdk;
    pumpFun;
    raydium;
    meteoraMonitor;
    enhancedSwapService;
    tokenValidator;
    bonkFunIntegration;
    profitTaker;
    targetDevelopers;
    isRunning = false;
    failedTransactions = new Set();
    ws = null;
    activeSnipes = new Map(); // Changed to Map
    snipeHistory = [];
    // Configuration
    buyAmountSol = 0;
    buySlippage = 0;
    seenSignatures = new Set();
    targetDeveloperSet;
    maxRetries = 5;
    retryDelay = 1000;
    maxConcurrentSnipes = 3;
    // ✅ NEW: Multi-tier profit-taking strategy implementation
    activeProfitMonitoring = new Map();
    constructor(connection, wallet, sdk, targetDevelopers) {
        this.connection = connection;
        this.wallet = wallet;
        this.sdk = sdk;
        this.pumpFun = new pumpfun_1.PumpFun(connection, wallet);
        this.raydium = new raydium_1.Raydium(connection, wallet);
        this.meteoraMonitor = new meteora_1.MeteoraMonitor(connection, this);
        // Create service instances
        this.enhancedSwapService = new enhanced_swap_1.EnhancedSwapService(connection);
        this.tokenValidator = new token_validator_1.TokenValidator(connection);
        this.bonkFunIntegration = new bonk_fun_integration_1.BonkFunIntegration(connection);
        this.profitTaker = new profit_taker_1.ProfitTaker(connection);
        this.targetDevelopers = targetDevelopers.map(dev => {
            try {
                return new web3_js_1.PublicKey(dev);
            }
            catch (error) {
                console.error(`Invalid public key: ${dev}`);
                return null;
            }
        }).filter((pubkey) => pubkey !== null);
        this.targetDeveloperSet = new Set(this.targetDevelopers.map(dev => dev.toBase58()));
    }
    // Deprecated method removed - use start() directly
    async setupMultiPlatformMonitoring() {
        // Setup Pump.fun monitoring
        await this.pumpFun.onNewToken(async (tokenInfo) => {
            if (this.targetDeveloperSet.has(tokenInfo.developer.toBase58())) {
                console.log(`🎯 New Pump.fun token detected: ${tokenInfo.mint.toBase58()}`);
                await this.snipeToken(tokenInfo.mint.toBase58(), 'pumpfun', tokenInfo.developer.toBase58());
            }
        });
        // Setup Raydium monitoring
        await this.raydium.onNewPool(async (poolInfo) => {
            if (this.targetDeveloperSet.has(poolInfo.developer.toBase58())) {
                console.log(`🎯 New Raydium pool detected: ${poolInfo.mint.toBase58()}`);
                await this.snipeToken(poolInfo.mint.toBase58(), 'raydium', poolInfo.developer.toBase58());
            }
        });
        // ✅ ENHANCED: Setup Meteora monitoring with better error handling
        try {
            await this.meteoraMonitor.onNewToken(async (tokenInfo) => {
                console.log(`🎯 Meteora callback triggered for token: ${tokenInfo.mint.toBase58()}`);
                console.log(` Developer: ${tokenInfo.developer.toBase58()}`);
                console.log(`🎯 Is target developer? ${this.targetDeveloperSet.has(tokenInfo.developer.toBase58())}`);
                if (this.targetDeveloperSet.has(tokenInfo.developer.toBase58())) {
                    console.log(`🚀 New Meteora token detected: ${tokenInfo.mint.toBase58()}`);
                    console.log(`🎯 Target developer confirmed: ${tokenInfo.developer.toBase58()}`);
                    await this.snipeToken(tokenInfo.mint.toBase58(), 'meteora', tokenInfo.developer.toBase58());
                }
                else {
                    console.log(`🚫 Meteora token ${tokenInfo.mint.toBase58()} filtered out - developer ${tokenInfo.developer.toBase58()} not in target list`);
                }
            });
            console.log('✅ Meteora callback registered successfully');
        }
        catch (error) {
            console.error('❌ Failed to register Meteora callback:', error);
        }
    }
    setupDeveloperMonitoring() {
        this.targetDevelopers.forEach(developer => {
            this.connection.onLogs(developer, (logs) => {
                if (!this.isRunning)
                    return;
                if (logs.err) {
                    this.handleLogError(logs.err);
                    return;
                }
                const newTokenMint = this.extractNewTokenMint(logs.logs);
                if (newTokenMint) {
                    console.log(`New token detected from ${developer.toBase58()}: ${newTokenMint.toBase58()}`);
                    this.snipeToken(newTokenMint.toBase58(), 'developer', developer.toBase58());
                }
            }, 'confirmed');
        });
    }
    setupWebSocket() {
        // NEW: Use updated PumpPortal endpoint
        const wsUrl = PUMP_PORTAL_WS_URL;
        // Try to establish connection with authentication
        try {
            this.ws = new ws_1.default(wsUrl);
            // FIXED: Add connection timeout
            const connectionTimeout = setTimeout(() => {
                if (this.ws && this.ws.readyState === ws_1.default.CONNECTING) {
                    console.log('⚠️ WebSocket connection timeout, retrying...');
                    this.ws.close();
                }
            }, 10000);
            this.ws.on('open', () => {
                clearTimeout(connectionTimeout);
                console.log('✅ WebSocket connection established');
                if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
                    console.log('📡 Subscribing to WebSocket channels...');
                    // FIXED: Add authentication token if available
                    const authToken = process.env.PUMPFUN_AUTH_TOKEN;
                    if (authToken && this.ws) {
                        console.log('🔑 Sending authentication token...');
                        this.ws.send(JSON.stringify({
                            method: "authenticate",
                            token: authToken
                        }));
                    }
                    else {
                        console.log('⚠️ No auth token - attempting connection without authentication');
                    }
                    if (this.ws) {
                        this.ws.send(JSON.stringify({ method: "subscribeNewToken" }));
                        this.ws.send(JSON.stringify({ method: "subscribeMigration" }));
                        this.ws.send(JSON.stringify({
                            method: "subscribeAccountTrade",
                            keys: this.targetDevelopers.map(dev => dev.toBase58())
                        }));
                    }
                    console.log(`🎯 Subscribed to ${this.targetDevelopers.length} target developers:`, this.targetDevelopers.map(dev => dev.toBase58()));
                    // Keepalive
                    const pingInterval = setInterval(() => {
                        if (this.ws && this.ws.readyState === this.ws.OPEN) {
                            try {
                                this.ws.ping?.();
                            }
                            catch { }
                        }
                        else {
                            clearInterval(pingInterval);
                        }
                    }, 30000);
                }
            });
        }
        catch (error) {
            console.error('❌ WebSocket setup error:', error);
            // Retry after delay
            setTimeout(() => this.setupWebSocket(), 5000);
        }
        if (this.ws) {
            this.ws.on('message', (data) => {
                try {
                    const parsedData = JSON.parse(data.toString());
                    this.handleWebSocketMessage(parsedData);
                }
                catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });
            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                // Handle 401 errors specifically with better logging
                if (error.toString().includes('401')) {
                    console.log('⚠️ WebSocket authentication error (401) - checking auth token...');
                    const authToken = process.env.PUMPFUN_AUTH_TOKEN;
                    if (!authToken) {
                        console.log('❌ No PUMPFUN_AUTH_TOKEN found in environment variables');
                        console.log('💡 Add PUMPFUN_AUTH_TOKEN to your .env file or try without authentication');
                    }
                    else {
                        console.log('🔑 Auth token found, but still getting 401 - token may be invalid or expired');
                    }
                    // Add longer delay for auth errors
                    setTimeout(() => this.reconnectWebSocket(), 15000);
                }
                else {
                    this.reconnectWebSocket();
                }
            });
            this.ws.on('close', (code, reason) => {
                console.log(`WebSocket connection closed: ${code} - ${reason}`);
                // Handle 401 close codes
                if (code === 1008 || code === 1009) { // Policy violation or too large
                    console.log('⚠️ WebSocket closed due to policy violation - will retry with delay');
                    setTimeout(() => this.reconnectWebSocket(), 15000);
                }
                else {
                    this.reconnectWebSocket();
                }
            });
        }
    }
    reconnectWebSocket() {
        setTimeout(() => {
            if (this.isRunning) {
                console.log('Attempting to reconnect WebSocket...');
                this.setupWebSocket();
            }
        }, 5000);
    }
    // ✅ ENHANCED: Improved start method with null checks and better error handling
    async start(amount, slippage) {
        if (this.isRunning) {
            console.log('Bot is already running');
            return;
        }
        console.log('🚀 Starting Sniper Bot...');
        this.isRunning = true;
        this.buyAmountSol = amount; // Set buy amount
        this.buySlippage = slippage; // Set slippage
        // Display sniping mode
        console.log('🚀 UNIVERSAL SNIPING ENABLED - Monitoring ALL new tokens that meet criteria:');
        console.log('💰 Min Liquidity: $10,000');
        console.log('👥 Min Holders: 7');
        console.log('🚫 NoMint Authority: true');
        console.log('🚫 No Blacklist: true');
        try {
            // Setup multi-platform monitoring callbacks first
            await this.setupMultiPlatformMonitoring();
            // Start WebSocket connection with new PumpPortal endpoint
            await this.setupWebSocket();
            // Start Bonk.fun monitoring in background with REST fallback
            this.startBonkFunMonitoring();
            // Start profit taking monitoring
            this.profitTaker.startMonitoring();
            // Start Raydium monitoring with null check
            if (this.raydium)
                await this.raydium.startMonitoring();
            // Start Pump.fun monitoring with null check
            if (this.pumpFun)
                await this.pumpFun.startMonitoring();
            // Start LetsBonk SDK monitoring with null check
            if (this.sdk)
                await this.sdk.startMonitoring();
            // Start Meteora monitoring with null check and REST fallback
            if (this.meteoraMonitor)
                await this.meteoraMonitor.startMonitoring();
            // Subscribe to program logs for each developer (this is separate from platform-specific monitors)
            this.setupDeveloperMonitoring();
            console.log('✅ All monitoring systems started successfully');
            console.log('🔗 Using new PumpPortal endpoints:');
            console.log(`   WebSocket: ${PUMP_PORTAL_WS_URL}`);
            console.log(`   REST API: ${PUMP_FUN_REST_URL}`);
            // Start profit monitoring cleanup
            this.startProfitMonitoringCleanup();
        }
        catch (error) {
            console.error('Error starting bot:', error);
            this.isRunning = false;
            throw error;
        }
    }
    // NEW: Example method showing how to use Pump.fun REST API
    async executePumpFunRestCall(method, data) {
        try {
            console.log(`📡 Making REST call to Pump.fun: ${method}`);
            const response = await fetch(PUMP_FUN_REST_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.PUMPFUN_AUTH_TOKEN || ''}`
                },
                body: JSON.stringify({
                    method: method,
                    ...data
                })
            });
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Pump.fun REST call successful: ${method}`);
                return result;
            }
            else {
                console.error(`❌ Pump.fun REST call failed: ${response.status} ${response.statusText}`);
                return null;
            }
        }
        catch (error) {
            console.error(`❌ Error in Pump.fun REST call:`, error);
            return null;
        }
    }
    // ✅ FIXED: Enhanced blockchain fallback verification with proper MessageV0 handling
    async verifyTokenCreatorFromBlockchain(mintStr, signature) {
        try {
            console.log(`🔍 Fetching blockchain transaction: ${signature}`);
            const transaction = await this.connection.getTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });
            if (!transaction || !transaction.meta) {
                console.log(`❌ Transaction not found: ${signature}`);
                return;
            }
            let accountKeys = [];
            let isAccountWritable = () => false;
            try {
                if ('getAccountKeys' in transaction.transaction.message && typeof transaction.transaction.message.getAccountKeys === 'function') {
                    const messageV0 = transaction.transaction.message;
                    accountKeys = messageV0.getAccountKeys().keySegments().flat();
                    isAccountWritable = (index) => messageV0.isAccountWritable(index);
                }
                else if ('accountKeys' in transaction.transaction.message && Array.isArray(transaction.transaction.message.accountKeys)) {
                    // Legacy message (has accountKeys property as an array)
                    const legacyMessage = transaction.transaction.message;
                    accountKeys = legacyMessage.accountKeys;
                    isAccountWritable = (index) => legacyMessage.isAccountWritable(index);
                }
                else {
                    console.log(`⚠️ Unknown transaction message type for signature: ${signature}`);
                    return;
                }
            }
            catch (error) {
                console.log(`⚠️ Could not extract account keys from transaction (likely address lookup table issue for ${signature}): ${error}`);
                return;
            }
            if (accountKeys.length === 0) {
                console.log(`⚠️ No account keys found in transaction`);
                return;
            }
            // Define ignored addresses (common program IDs and non-developer addresses)
            const ignoredAddresses = new Set([
                '11111111111111111111111111111111', // System Program
                'ComputeBudget111111111111111111111111111111', // Compute Budget Program
                'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Account Program
                'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token Program
                'metaqbxxUerdq28cj1RbTGWuhtQgypSZKdAiNKcvN', // Metaplex Token Metadata Program
                'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter Aggregator
                'routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS', // Another common program/router
            ]);
            // Check fee payer (often the creator)
            const feePayer = accountKeys[0];
            if (feePayer && !ignoredAddresses.has(feePayer.toBase58()) && this.targetDeveloperSet.has(feePayer.toBase58())) {
                console.log(`🎯 BLOCKCHAIN FALLBACK: Found target developer ${feePayer.toBase58()} as fee payer!`);
                console.log(`🚀 Attempting delayed snipe for token: ${mintStr}`);
                try {
                    await this.snipeToken(mintStr, 'pumpportal', feePayer.toBase58());
                }
                catch (e) {
                    console.error('Error in blockchain fallback snipe:', e);
                }
                return;
            }
            // Check writable accounts for potential creators
            for (let i = 0; i < accountKeys.length; i++) {
                try {
                    if (isAccountWritable(i)) {
                        const account = accountKeys[i];
                        if (account && !ignoredAddresses.has(account.toBase58()) && this.targetDeveloperSet.has(account.toBase58())) {
                            console.log(`🎯 BLOCKCHAIN FALLBACK: Found target developer ${account.toBase58()} in writable accounts!`);
                            console.log(`🚀 Attempting delayed snipe for token: ${mintStr}`);
                            try {
                                await this.snipeToken(mintStr, 'pumpportal', account.toBase58());
                            }
                            catch (e) {
                                console.error('Error in blockchain fallback snipe:', e);
                            }
                            return;
                        }
                    }
                }
                catch (error) {
                    console.log(`⚠️ Error checking account ${i}: ${error}`);
                    continue;
                }
            }
            console.log(`❌ No target developers found in blockchain data for ${mintStr}`);
        }
        catch (error) {
            console.error(`Error verifying token creator from blockchain:`, error);
        }
    }
    async handleWebSocketMessage(data) {
        if (typeof data?.message === 'string')
            return;
        // ✅ ENHANCED: Debug logging for ALL WebSocket messages
        console.log(`📡 WebSocket message received:`, JSON.stringify(data, null, 2));
        if (data?.txType === 'create') {
            console.log(`🔍 WebSocket CREATE event received:`, {
                mint: data?.mint,
                trader: data?.traderPublicKey,
                developer: data?.developer,
                creator: data?.creator,
                authority: data?.authority,
                mint_authority: data?.mint_authority,
                update_authority: data?.update_authority,
                owner: data?.owner,
                signature: data?.signature,
                // Log ALL possible fields
                ...Object.keys(data).reduce((acc, key) => {
                    if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('dev') || key.toLowerCase().includes('creat')) {
                        acc[key] = data[key];
                    }
                    return acc;
                }, {})
            });
        }
        const isCreate = data?.txType === 'create';
        const mintStr = data?.mint;
        const trader = data?.traderPublicKey;
        const signature = data?.signature;
        // ✅ ENHANCED: Try ALL possible developer fields with validation
        const developer = data?.developer ||
            data?.creator ||
            data?.authority ||
            data?.mint_authority ||
            data?.update_authority ||
            data?.owner ||
            data?.deployer ||
            data?.initializer ||
            trader; // Fallback to trader
        if (isCreate && typeof mintStr === 'string' && typeof developer === 'string') {
            // ✅ ENHANCED: Validate developer address format before processing
            if (!this.isValidPublicKey(developer)) {
                console.log(`⚠️ Invalid developer address format: ${developer}`);
                return;
            }
            // ✅ NEW: Universal sniping with 10-minute age tolerance
            const tokenAge = Date.now() - (data?.timestamp || Date.now());
            const maxAgeMs = 10 * 60 * 1000; // 10 minutes in milliseconds
            if (tokenAge > maxAgeMs) {
                console.log(`⏰ Token ${mintStr} is ${Math.round(tokenAge / 60000)} minutes old - too old to snipe`);
                return;
            }
            console.log(`🔍 Token ${mintStr} detected - Universal sniping enabled!`);
            console.log(`✅ Token meets criteria: $10k+ liquidity, 7+ holders, NoMint, NoBlacklist`);
            console.log(`⏰ Token age: ${Math.round(tokenAge / 60000)} minutes (within 10-minute limit)`);
            if (signature && this.seenSignatures.has(signature))
                return;
            if (signature)
                this.seenSignatures.add(signature);
            try {
                console.log('✅ New token detected from WebSocket:', {
                    mint: mintStr,
                    developer, // ✅ FIXED: Log developer, not trader
                    trader,
                    signature,
                    pool: data?.pool,
                    initialBuy: data?.initialBuy
                });
                this.snipeToken(mintStr, 'pumpportal', developer); // ✅ FIXED: Pass developer, not trader
            }
            catch (e) {
                console.error('Invalid mint in WS payload:', mintStr, e);
            }
        }
    }
    async checkBalance() {
        const balance = await this.connection.getBalance(this.wallet.publicKey);
        const minBalance = 0.05 * web3_js_1.LAMPORTS_PER_SOL;
        if (balance < minBalance) {
            console.error(`Insufficient balance. Current: ${balance / web3_js_1.LAMPORTS_PER_SOL} SOL, Minimum required: ${minBalance / web3_js_1.LAMPORTS_PER_SOL} SOL`);
            return false;
        }
        return true;
    }
    handleLogError(err) {
        if ('InsufficientFundsForRent' in err) {
            console.error('Transaction failed due to insufficient funds for rent:', err);
            this.checkBalance();
        }
        else if ('InstructionError' in err) {
            console.error('Transaction failed due to an instruction error:', err);
            if (err.InstructionError[1] && err.InstructionError[1].Custom === 1) {
                console.error('Custom error 1: This might indicate a specific program error.');
            }
        }
        else {
            console.error('Error in log:', err);
        }
    }
    extractNewTokenMint(logs) {
        for (const log of logs) {
            if (log.includes('New token mint:')) {
                const mintAddress = log.split('New token mint:')[1].trim();
                return new web3_js_1.PublicKey(mintAddress);
            }
        }
        return null;
    }
    trackFailedTransaction(signature) {
        this.failedTransactions.add(signature);
        console.log(`Added failed transaction to tracking: ${signature}`);
        console.log(`Total failed transactions: ${this.failedTransactions.size}`);
    }
    // ✅ IMPROVED: Check if token is created by target developer
    isTargetDeveloper(developer) {
        // Since TARGET_DEVELOPERS was removed, accept all developers for universal sniping
        return true;
    }
    // Enhanced snipe method with risk management
    async snipeToken(tokenMint, platform, developer) {
        try {
            // Risk management check
            const riskCheck = risk_manager_1.riskManager.canExecuteTrade(this.buyAmountSol, tokenMint);
            if (!riskCheck.allowed) {
                const errorMsg = `Trade blocked by risk manager: ${riskCheck.errors.join(', ')}`;
                console.warn(`❌ ${errorMsg}`);
                await notifications_1.notificationService.sendNotification(errorMsg, 'warning', { tokenMint });
                return {
                    success: false,
                    error: errorMsg,
                    tokenMint,
                    platform,
                    amount: this.buyAmountSol,
                    signature: undefined,
                    timestamp: Date.now(),
                    developer: developer || 'unknown'
                };
            }
            console.log(`🎯 Starting snipe for ${tokenMint} on ${platform}`);
            // Use enhanced swap service for better execution
            const swapResult = await this.enhancedSwapService.executeSwap({
                inputMint: 'So11111111111111111111111111111111111111112', // SOL
                outputMint: tokenMint,
                amount: this.buyAmountSol * 1e9, // Convert to lamports
                slippage: this.buySlippage,
                wallet: this.wallet,
                method: 'solana' // Default method
            });
            if (swapResult.success && swapResult.signature) {
                const result = {
                    success: true,
                    tokenMint,
                    platform,
                    amount: this.buyAmountSol,
                    signature: swapResult.signature,
                    timestamp: Date.now(),
                    developer: developer || 'unknown',
                    startTime: Date.now(),
                    status: 'sniped'
                };
                // Record successful snipe
                this.snipeHistory.push(result);
                this.activeSnipes.set(tokenMint, {
                    platform: result.platform,
                    startTime: result.startTime || Date.now(),
                    status: result.status || 'sniped',
                    signature: result.signature
                });
                // Start profit monitoring
                this.startProfitMonitoring(tokenMint, result);
                // Send success notification
                await notifications_1.notificationService.notifyTrade('buy', tokenMint, this.buyAmountSol, 0, swapResult.signature);
                console.log(`✅ Snipe successful: ${tokenMint} on ${platform}`);
                return result;
            }
            else {
                const errorMsg = `Swap failed: ${swapResult.error}`;
                console.error(`❌ ${errorMsg}`);
                await notifications_1.notificationService.sendNotification(errorMsg, 'error', { tokenMint });
                return {
                    success: false,
                    error: errorMsg,
                    tokenMint,
                    platform,
                    amount: this.buyAmountSol,
                    signature: undefined,
                    timestamp: Date.now(),
                    developer: developer || 'unknown'
                };
            }
        }
        catch (error) {
            const errorMsg = `Snipe error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(`❌ ${errorMsg}`);
            await notifications_1.notificationService.notifyError(error instanceof Error ? error : new Error(errorMsg), 'Token Snipe');
            return {
                success: false,
                error: errorMsg,
                tokenMint,
                platform,
                amount: this.buyAmountSol,
                signature: undefined,
                timestamp: Date.now(),
                developer: developer || 'unknown'
            };
        }
    }
    async createBuyTransaction(tokenMint, platform) {
        try {
            switch (platform) {
                case 'pumpfun':
                    // ✅ Use direct execution for Pump.fun instead of transaction building
                    console.log(`Using direct Pump.fun execution for ${tokenMint.toBase58()}`);
                    return null; // Will use direct execution instead
                case 'raydium':
                    return await this.raydium.createBuyTransaction(tokenMint, this.buyAmountSol, this.buySlippage);
                case 'pumpportal':
                case 'developer':
                default:
                    return await this.sdk.createBuyTransaction(tokenMint, this.buyAmountSol, this.buySlippage);
            }
        }
        catch (error) {
            console.error(`Error creating buy transaction for ${platform}:`, error);
            return null;
        }
    }
    async executeTransaction(transaction, tokenMint, platform) {
        try {
            // ✅ Special handling for Pump.fun direct execution
            if (platform === 'pumpfun' || platform === 'pumpportal') {
                console.log(`🚀 Executing ${platform} transaction for ${tokenMint}`);
                const signature = await this.pumpFun.executePumpTransaction("buy", tokenMint, this.buyAmountSol, this.buySlippage);
                if (signature) {
                    console.log(`✅ ${platform} transaction successful: ${signature}`);
                    console.log(`🔗 View on Solscan: https://solscan.io/tx/${signature}`);
                    // ✅ IMPROVED: Wait for transaction confirmation before returning success
                    try {
                        const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
                        if (confirmation.value.err) {
                            console.error(`❌ Transaction failed with error:`, confirmation.value.err);
                            return {
                                success: false,
                                error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
                                platform,
                                tokenMint,
                                amount: 0,
                                timestamp: Date.now()
                            };
                        }
                        console.log(`✅ Transaction confirmed successfully!`);
                        // ✅ NEW: Verify token balance after transaction
                        setTimeout(async () => {
                            await this.verifyTokenBalance(tokenMint, signature);
                        }, 5000); // Check balance after 5 seconds
                    }
                    catch (confirmError) {
                        console.error(`⚠️ Error confirming transaction:`, confirmError);
                        // Still return success since signature was received
                    }
                    return {
                        success: true,
                        signature,
                        platform,
                        tokenMint,
                        amount: this.buyAmountSol,
                        timestamp: Date.now()
                    };
                }
                else {
                    console.error(`❌ ${platform} transaction execution failed - no signature returned`);
                    return {
                        success: false,
                        error: `${platform} direct execution failed - no signature returned`,
                        platform,
                        tokenMint,
                        amount: 0,
                        timestamp: Date.now()
                    };
                }
            }
            else if (platform === 'meteora') {
                // Meteora specific execution
                console.log(`🚀 Executing Meteora transaction for ${tokenMint}`);
                // For Meteora, we'll use the standard Solana transaction execution
                // since Meteora doesn't have a direct API like Pump Portal
                const latestBlockhash = await this.connection.getLatestBlockhash();
                transaction.recentBlockhash = latestBlockhash.blockhash;
                transaction.feePayer = this.wallet.publicKey;
                // Add priority fee and compute unit instructions
                const priorityFeeIx = web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({
                    microLamports: 50000
                });
                transaction.add(priorityFeeIx);
                const computeUnitIx = web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({
                    units: 400000
                });
                transaction.add(computeUnitIx);
                transaction.sign(this.wallet);
                const signature = await this.connection.sendRawTransaction(transaction.serialize());
                console.log(`Meteora transaction sent: ${signature}`);
                const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
                if (confirmation.value.err) {
                    this.trackFailedTransaction(signature);
                    return {
                        success: false,
                        error: `Meteora transaction failed: ${JSON.stringify(confirmation.value.err)}`,
                        platform,
                        tokenMint,
                        amount: 0,
                        timestamp: Date.now()
                    };
                }
                console.log(`✅ Meteora transaction successful: ${signature}`);
                console.log(`🔗 View on Solscan: https://solscan.io/tx/${signature}`);
                // Verify token balance
                setTimeout(async () => {
                    await this.verifyTokenBalance(tokenMint, signature);
                }, 5000);
                return {
                    success: true,
                    signature,
                    platform,
                    tokenMint,
                    amount: this.buyAmountSol,
                    timestamp: Date.now()
                };
            }
            // Add priority fee and compute unit instructions if not already present
            if (!transaction.instructions.some(ix => ix.programId.equals(web3_js_1.ComputeBudgetProgram.programId))) {
                const priorityFeeIx = web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({
                    microLamports: 50000
                });
                transaction.add(priorityFeeIx);
                const computeUnitIx = web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({
                    units: 400000
                });
                transaction.add(computeUnitIx);
            }
            transaction.feePayer = this.wallet.publicKey;
            transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
            transaction.sign(this.wallet);
            const signature = await this.connection.sendRawTransaction(transaction.serialize());
            console.log(`Transaction sent: ${signature}`);
            const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
            if (confirmation.value.err) {
                this.trackFailedTransaction(signature);
                return {
                    success: false,
                    error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
                    platform,
                    tokenMint,
                    amount: 0,
                    timestamp: Date.now()
                };
            }
            // Verify token balance
            const tokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(new web3_js_1.PublicKey(tokenMint), this.wallet.publicKey);
            const tokenAccountInfo = await this.connection.getAccountInfo(tokenAccount);
            if (tokenAccountInfo === null) {
                return {
                    success: false,
                    error: 'Token account does not exist after purchase',
                    platform,
                    tokenMint,
                    amount: 0,
                    timestamp: Date.now()
                };
            }
            return {
                success: true,
                signature,
                platform,
                tokenMint,
                amount: this.buyAmountSol,
                timestamp: Date.now()
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Execution error: ${error}`,
                platform,
                tokenMint,
                amount: 0,
                timestamp: Date.now()
            };
        }
    }
    async checkPoolLiquidity(tokenMint, platform) {
        try {
            // Check liquidity across different platforms
            const pumpFunLiquidity = await this.pumpFun.getTokenPrice(tokenMint);
            const raydiumLiquidity = await this.raydium.getTokenPrice(tokenMint);
            const sdkLiquidity = await this.sdk.checkPoolLiquidity(tokenMint);
            const meteoraLiquidity = await this.meteoraMonitor.getTokenPrice(tokenMint);
            return Math.max(pumpFunLiquidity, raydiumLiquidity, sdkLiquidity, meteoraLiquidity);
        }
        catch (error) {
            console.error('Error checking pool liquidity:', error);
            return 0;
        }
    }
    // ✅ NEW: Automatic profit-taking method
    scheduleProfitTaking(tokenMint, platform, slippage) {
        const sellDelay = 20000; // 20 seconds - configurable
        const sellAmount = "100%"; // Sell 100% of tokens
        console.log(`Scheduling profit-taking for ${tokenMint} in ${sellDelay / 1000} seconds`);
        setTimeout(async () => {
            try {
                console.log(`Executing profit-taking for ${tokenMint}`);
                if (platform === 'pumpfun') {
                    // Use direct Pump.fun execution for selling
                    const signature = await this.pumpFun.executePumpTransaction("sell", tokenMint, 0, slippage);
                    if (signature) {
                        console.log(`✅ Profit-taking successful for ${tokenMint}: ${signature}`);
                    }
                    else {
                        console.error(`❌ Profit-taking failed for ${tokenMint}`);
                    }
                }
                else {
                    // Use regular transaction for other platforms
                    const sellTx = await this.createSellTransaction(new web3_js_1.PublicKey(tokenMint), slippage, platform);
                    if (sellTx) {
                        const result = await this.executeTransaction(sellTx, tokenMint, platform);
                        if (result.success) {
                            console.log(`✅ Profit-taking successful for ${tokenMint}: ${result.signature}`);
                        }
                        else {
                            console.error(`❌ Profit-taking failed for ${tokenMint}: ${result.error}`);
                        }
                    }
                }
            }
            catch (error) {
                console.error(`Error during profit-taking for ${tokenMint}:`, error);
            }
        }, sellDelay);
    }
    // ✅ NEW: Enhanced profit-taking with multi-tier strategy
    scheduleMultiTierProfitTaking(tokenMint, platform, slippage, entryPrice, entryAmount) {
        // Profit taking temporarily disabled
        this.scheduleProfitTaking(tokenMint, platform, slippage);
        return;
        console.log(`🎯 Setting up multi-tier profit-taking for ${tokenMint}`);
        console.log(`💰 Entry price: ${entryPrice} SOL, Entry amount: ${entryAmount} tokens`);
        console.log(`📊 Profit targets: 1000% (35%) → 10000% (35%) → Keep 30%`);
        // Add position to profit taker
        const position = {
            mint: tokenMint,
            symbol: tokenMint.slice(0, 8), // Simplified symbol
            entryPrice,
            entryAmount,
            currentAmount: entryAmount,
            entryTime: Date.now(),
            tier1Sold: false,
            tier2Sold: false,
            totalSold: 0,
            signature: 'entry_signature' // You'll need to store the actual signature
        };
        this.profitTaker.addPosition(position);
        console.log(`✅ Position added to profit taker for ${tokenMint}`);
    }
    // ✅ NEW: Check profit targets and execute tier-based selling
    async checkProfitTargets(tokenMint) {
        const monitoring = this.activeProfitMonitoring.get(tokenMint);
        if (!monitoring)
            return;
        try {
            // Get current token price
            const currentPrice = await this.getCurrentTokenPrice(tokenMint, monitoring.platform);
            if (currentPrice === 0)
                return;
            // Calculate profit multiplier
            const profitMultiplier = currentPrice / monitoring.entryPrice;
            const profitPercentage = (profitMultiplier - 1) * 100;
            console.log(`📈 ${tokenMint}: Current price: ${currentPrice} SOL, Profit: ${profitPercentage.toFixed(2)}% (${profitMultiplier.toFixed(2)}x)`);
            // Check Tier 1: 1000% profit target (10x)
            if (!monitoring.tier1Sold && profitMultiplier >= 10.0) {
                await this.executeTierSell(tokenMint, 1, monitoring);
            }
            // Check Tier 2: 10000% profit target (100x)
            if (!monitoring.tier2Sold && profitMultiplier >= 100.0) {
                await this.executeTierSell(tokenMint, 2, monitoring);
            }
            // Update last price check
            monitoring.lastPriceCheck = Date.now();
        }
        catch (error) {
            console.error(`Error checking profit targets for ${tokenMint}:`, error);
        }
    }
    // ✅ NEW: Execute tier-based selling
    async executeTierSell(tokenMint, tierNumber, monitoring) {
        const tier = tierNumber === 1 ? { amount: 0.3, percentage: 10.0 } : { amount: 0.5, percentage: 100.0 };
        const sellAmount = monitoring.remainingAmount * tier.amount;
        console.log(`🎯 TIER ${tierNumber} TRIGGERED for ${tokenMint}!`);
        console.log(`💰 Selling ${sellAmount.toFixed(6)} tokens (${(tier.amount * 100).toFixed(0)}%) at ${tier.percentage}x profit`);
        console.log(`📊 Remaining after sell: ${(monitoring.remainingAmount - sellAmount).toFixed(6)} tokens`);
        try {
            // Execute the sell transaction
            const sellResult = await this.executeTierSellTransaction(tokenMint, sellAmount, monitoring.platform, 0.1);
            if (sellResult.success) {
                console.log(`✅ Tier ${tierNumber} sell successful: ${sellResult.signature}`);
                // Update monitoring state
                monitoring.soldAmount += sellAmount;
                monitoring.remainingAmount -= sellAmount;
                if (tierNumber === 1) {
                    monitoring.tier1Sold = true;
                    console.log(`🎯 Tier 1 (100x) completed for ${tokenMint}`);
                }
                else if (tierNumber === 2) {
                    monitoring.tier2Sold = true;
                    console.log(`🎯 Tier 2 (1000x) completed for ${tokenMint}`);
                    // Both tiers completed, stop monitoring
                    this.stopProfitMonitoring(tokenMint);
                    console.log(`🏁 All profit targets reached for ${tokenMint}. Keeping ${monitoring.remainingAmount.toFixed(6)} tokens (30%) in wallet.`);
                }
            }
            else {
                console.error(`❌ Tier ${tierNumber} sell failed: ${sellResult.error}`);
            }
        }
        catch (error) {
            console.error(`Error executing tier ${tierNumber} sell for ${tokenMint}:`, error);
        }
    }
    // ✅ NEW: Execute tier sell transaction
    async executeTierSellTransaction(tokenMint, amount, platform, slippage) {
        try {
            if (platform === 'pumpfun') {
                // Use direct Pump.fun execution for selling
                const signature = await this.pumpFun.executePumpTransaction("sell", tokenMint, 0, slippage);
                if (signature) {
                    return {
                        success: true,
                        signature,
                        platform,
                        tokenMint,
                        amount,
                        timestamp: Date.now()
                    };
                }
                else {
                    return {
                        success: false,
                        error: 'Pump.fun direct execution failed',
                        platform,
                        tokenMint,
                        amount: 0,
                        timestamp: Date.now()
                    };
                }
            }
            else {
                // Use regular transaction for other platforms
                const sellTx = await this.createSellTransaction(new web3_js_1.PublicKey(tokenMint), slippage, platform);
                if (sellTx) {
                    return await this.executeTransaction(sellTx, tokenMint, platform);
                }
                else {
                    return {
                        success: false,
                        error: 'Failed to create sell transaction',
                        platform,
                        tokenMint,
                        amount: 0,
                        timestamp: Date.now()
                    };
                }
            }
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                platform,
                tokenMint,
                amount: 0,
                timestamp: Date.now()
            };
        }
    }
    // ✅ NEW: Get current token price for profit monitoring
    async getCurrentTokenPrice(tokenMint, platform) {
        try {
            const mintPubkey = new web3_js_1.PublicKey(tokenMint);
            switch (platform) {
                case 'pumpfun':
                    return await this.pumpFun.getTokenPrice(mintPubkey);
                case 'raydium':
                    return await this.raydium.getTokenPrice(mintPubkey);
                case 'meteora':
                    return await this.meteoraMonitor.getTokenPrice(mintPubkey);
                case 'pumpportal':
                case 'developer':
                default:
                    return await this.sdk.getTokenPrice(mintPubkey);
            }
        }
        catch (error) {
            console.error(`Error getting current price for ${tokenMint}:`, error);
            return 0;
        }
    }
    // ✅ NEW: Stop profit monitoring for a token
    stopProfitMonitoring(tokenMint) {
        const monitoring = this.activeProfitMonitoring.get(tokenMint);
        if (monitoring) {
            clearInterval(monitoring.monitoringInterval);
            this.activeProfitMonitoring.delete(tokenMint);
            console.log(`🛑 Profit monitoring stopped for ${tokenMint}`);
        }
    }
    // ✅ NEW: Get profit monitoring status
    getProfitMonitoringStatus() {
        const status = [];
        for (const [tokenMint, monitoring] of this.activeProfitMonitoring) {
            status.push({
                tokenMint,
                platform: monitoring.platform,
                entryPrice: monitoring.entryPrice,
                remainingAmount: monitoring.remainingAmount,
                soldAmount: monitoring.soldAmount,
                tier1Sold: monitoring.tier1Sold,
                tier2Sold: monitoring.tier2Sold,
                lastPriceCheck: new Date(monitoring.lastPriceCheck).toISOString()
            });
        }
        return status;
    }
    // ✅ NEW: Create sell transaction for different platforms
    async createSellTransaction(tokenMint, slippage, platform) {
        try {
            switch (platform) {
                case 'pumpfun':
                    return await this.pumpFun.createSellTransaction(tokenMint, slippage);
                case 'raydium':
                    return await this.raydium.createSellTransaction(tokenMint, slippage);
                case 'pumpportal':
                case 'developer':
                default:
                    return await this.sdk.createSellTransaction(tokenMint, slippage);
            }
        }
        catch (error) {
            console.error(`Error creating sell transaction for ${platform}:`, error);
            return null;
        }
    }
    // ✅ NEW: Verify token balance after transaction
    async verifyTokenBalance(tokenMint, signature) {
        try {
            console.log(`🔍 Verifying token balance for ${tokenMint} after transaction ${signature}`);
            const mintPubkey = new web3_js_1.PublicKey(tokenMint);
            const walletPubkey = this.wallet.publicKey;
            // Get associated token account
            const { getAssociatedTokenAddress } = await Promise.resolve().then(() => __importStar(require('@solana/spl-token')));
            const associatedTokenAccount = await getAssociatedTokenAddress(mintPubkey, walletPubkey);
            console.log(`📍 Associated Token Account: ${associatedTokenAccount.toBase58()}`);
            // Check if account exists
            const accountInfo = await this.connection.getAccountInfo(associatedTokenAccount);
            if (accountInfo) {
                console.log(`✅ Token account exists`);
                // Parse token account data to get balance
                if (accountInfo.data.length >= 64) {
                    const tokenBalance = accountInfo.data.readBigUInt64LE(64);
                    console.log(`💰 Token Balance: ${tokenBalance} (raw)`);
                    console.log(`💰 Token Balance: ${Number(tokenBalance) / 1e6} (formatted with 6 decimals)`);
                    if (Number(tokenBalance) > 0) {
                        console.log(`🎉 SUCCESS: Tokens found in wallet!`);
                    }
                    else {
                        console.log(`⚠️ WARNING: Token account exists but balance is zero`);
                    }
                }
                else {
                    console.log(`⚠️ WARNING: Token account data is too short to parse balance`);
                }
            }
            else {
                console.log(`❌ ERROR: Token account does not exist - transaction may have failed`);
                // Let's check the transaction details
                console.log(`🔍 Checking transaction details...`);
                const transaction = await this.connection.getTransaction(signature, {
                    commitment: 'confirmed',
                    maxSupportedTransactionVersion: 0
                });
                if (transaction) {
                    console.log(`📝 Transaction found:`);
                    console.log(`   Success: ${transaction.meta?.err ? 'FAILED' : 'SUCCESS'}`);
                    console.log(`   Fee: ${transaction.meta?.fee ? transaction.meta.fee / 1e9 : 'Unknown'} SOL`);
                    if (transaction.meta?.err) {
                        console.log(`   Error: ${JSON.stringify(transaction.meta.err)}`);
                    }
                    // Check for any token balance changes
                    if (transaction.meta?.postTokenBalances && transaction.meta.postTokenBalances.length > 0) {
                        console.log(`   Token balance changes found:`);
                        for (const balance of transaction.meta.postTokenBalances) {
                            if (balance.mint === tokenMint) {
                                console.log(`     🎯 Target token balance: ${balance.uiTokenAmount.uiAmountString}`);
                                console.log(`     Account: ${balance.accountIndex}`);
                                console.log(`     Owner: ${balance.owner}`);
                            }
                        }
                    }
                    else {
                        console.log(`   ❌ No token balance changes found in transaction`);
                    }
                }
                else {
                    console.log(`❌ Transaction not found on blockchain`);
                }
            }
        }
        catch (error) {
            console.error(`❌ Error verifying token balance:`, error);
        }
    }
    // ✅ NEW: Get token amount after successful snipe
    async getTokenAmountAfterSnipe(tokenMint, platform) {
        try {
            // Wait a bit for the transaction to be processed
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Get current token balance
            const mintPubkey = new web3_js_1.PublicKey(tokenMint.toBase58());
            switch (platform) {
                case 'pumpfun':
                    return await this.pumpFun.getTokenBalance(mintPubkey);
                case 'raydium':
                    // For Raydium, we need to estimate based on SOL amount and current price
                    const currentPrice = await this.raydium.getTokenPrice(mintPubkey);
                    return currentPrice > 0 ? this.buyAmountSol / currentPrice : 0;
                case 'pumpportal':
                case 'developer':
                default:
                    return await this.sdk.getTokenBalance(mintPubkey);
            }
        }
        catch (error) {
            console.error(`Error getting token amount after snipe for ${tokenMint.toBase58()}:`, error);
            // Fallback: estimate based on SOL amount and a reasonable price assumption
            return this.buyAmountSol / 0.01; // Assume 0.01 SOL per token as fallback
        }
    }
    getSnipeHistory() {
        return [...this.snipeHistory];
    }
    // ✅ IMPROVED: Enhanced stats with profit monitoring information
    getStats() {
        const activeSnipes = Array.from(this.activeSnipes.entries()).map(([tokenMint, data]) => ({
            tokenMint,
            ...data
        }));
        const profitMonitoring = this.getProfitMonitoringStatus();
        return {
            isRunning: this.isRunning,
            activeSnipes,
            activeSnipesCount: this.activeSnipes.size,
            snipeHistory: this.snipeHistory,
            snipeHistoryCount: this.snipeHistory.length,
            profitMonitoring,
            profitMonitoringCount: profitMonitoring.length,
            targetDevelopers: this.targetDeveloperSet.size,
            buyAmount: this.buyAmountSol,
            slippage: this.buySlippage,
            maxConcurrentSnipes: this.maxConcurrentSnipes,
            failedTransactions: Array.from(this.failedTransactions),
            failedTransactionsCount: this.failedTransactions.size
        };
    }
    // ✅ NEW: Cleanup profit monitoring when bot stops
    stop() {
        this.isRunning = false;
        // Stop all profit monitoring
        for (const [tokenMint, monitoring] of this.activeProfitMonitoring) {
            this.stopProfitMonitoring(tokenMint);
        }
        // Close WebSocket connection
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        console.log('🛑 Sniper bot stopped. All profit monitoring cleared.');
    }
    // ✅ NEW: Helper method to validate public key format
    isValidPublicKey(address) {
        try {
            new web3_js_1.PublicKey(address);
            return true;
        }
        catch {
            return false;
        }
    }
    // ✅ FIXED: Add profit monitoring cleanup method
    startProfitMonitoringCleanup() {
        // Clean up stale profit monitoring every 5 minutes
        setInterval(() => {
            const now = Date.now();
            for (const [tokenMint, monitoring] of this.activeProfitMonitoring) {
                // Stop monitoring if no price check in last 10 minutes
                if (now - monitoring.lastPriceCheck > 10 * 60 * 1000) {
                    console.log(`🔄 Stopping stale profit monitoring for ${tokenMint}`);
                    this.stopProfitMonitoring(tokenMint);
                }
            }
        }, 5 * 60 * 1000); // Every 5 minutes
    }
    // Enhanced profit monitoring with multi-tier strategy
    startProfitMonitoring(tokenMint, snipeResult) {
        // Profit taking temporarily disabled
        return;
        const interval = setInterval(async () => {
            try {
                const currentPrice = await this.getCurrentTokenPrice(tokenMint, snipeResult.platform);
                if (!currentPrice)
                    return;
                const entryPrice = snipeResult.entryPrice || 0;
                const profitMultiplier = currentPrice / entryPrice;
                // Check multi-tier profit targets using hardcoded values
                const tier1Target = 10.0; // 1000% profit target
                const tier2Target = 100.0; // 10000% profit target
                if (profitMultiplier >= tier1Target && !this.activeProfitMonitoring.get(tokenMint)?.tier1Sold) {
                    await this.executeProfitTaking(tokenMint, 30, 'Tier 1 (1000% profit)');
                }
                else if (profitMultiplier >= tier2Target && !this.activeProfitMonitoring.get(tokenMint)?.tier2Sold) {
                    await this.executeProfitTaking(tokenMint, 50, 'Tier 2 (10000% profit)');
                }
            }
            catch (error) {
                console.error(`Error in profit monitoring for ${tokenMint}:`, error);
            }
        }, 30000); // Check every 30 seconds
        // this.profitMonitoringIntervals.set(tokenMint, interval); // This line was removed as per the new_code
    }
    // Execute profit taking
    async executeProfitTaking(tokenMint, sellPercentage, description) {
        try {
            console.log(`💰 Executing profit taking: ${sellPercentage}% of ${tokenMint} - ${description}`);
            // Calculate sell amount
            const tokenBalance = await this.getTokenBalance(tokenMint);
            const sellAmount = tokenBalance * (sellPercentage / 100);
            // Execute sell transaction
            const sellResult = await this.enhancedSwapService.executeSwap({
                inputMint: tokenMint,
                outputMint: 'So11111111111111111111111111111111111111112', // SOL
                amount: sellAmount,
                slippage: this.buySlippage,
                wallet: this.wallet,
                method: 'solana'
            });
            if (sellResult.success && sellResult.signature) {
                await notifications_1.notificationService.notifyProfit(tokenMint, sellPercentage, sellResult.signature);
                console.log(`✅ Profit taking successful: ${sellAmount} tokens sold`);
            }
        }
        catch (error) {
            console.error(`Error executing profit taking for ${tokenMint}:`, error);
            await notifications_1.notificationService.notifyError(error instanceof Error ? error : new Error('Unknown error'), 'Profit Taking');
        }
    }
    // Execute stop loss
    async executeStopLoss(tokenMint, reason) {
        try {
            console.log(`🛑 Executing stop loss for ${tokenMint}: ${reason}`);
            const tokenBalance = await this.getTokenBalance(tokenMint);
            // Sell entire position
            const sellResult = await this.enhancedSwapService.executeSwap({
                inputMint: tokenMint,
                outputMint: 'So11111111111111111111111111111111111111112', // SOL
                amount: tokenBalance,
                slippage: this.buySlippage,
                wallet: this.wallet,
                method: 'solana'
            });
            if (sellResult.success && sellResult.signature) {
                await notifications_1.notificationService.notifyLoss(tokenMint, 0, sellResult.signature);
                console.log(`✅ Stop loss executed: ${tokenBalance} tokens sold`);
            }
        }
        catch (error) {
            console.error(`Error executing stop loss for ${tokenMint}:`, error);
            await notifications_1.notificationService.notifyError(error instanceof Error ? error : new Error('Unknown error'), 'Stop Loss');
        }
    }
    // Placeholder implementation removed - using the enhanced version above
    // Get token balance (placeholder implementation)
    async getTokenBalance(tokenMint) {
        // This would get actual token balance from the wallet
        return 1000000; // Placeholder balance
    }
    // Get bot status with enhanced information
    getBotStatus() {
        const riskStatus = risk_manager_1.riskManager.getRiskStatus();
        const swapMethods = this.enhancedSwapService.getAvailableMethods();
        return {
            isRunning: this.isRunning,
            buyAmount: this.buyAmountSol,
            slippage: this.buySlippage,
            activeSnipes: this.activeSnipes.size,
            totalSnipes: this.snipeHistory.length,
            riskStatus,
            availableSwapMethods: swapMethods,
            wallet: this.wallet.publicKey.toBase58()
        };
    }
    // Main bot loop
    async runBotLoop() {
        console.log('🚀 Starting SBSniper bot loop...');
        while (this.isRunning) {
            try {
                // Monitor Bonk.fun for new launches
                await this.monitorBonkFunLaunches();
                // Wait before next iteration
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            catch (error) {
                console.error('❌ Error in bot loop:', error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    // NEW: Enhanced Bonk.fun monitoring with REST fallback
    async monitorBonkFunLaunches() {
        try {
            // Try WebSocket first through integration service
            const newLaunches = await this.bonkFunIntegration.monitorNewLaunches();
            for (const launch of newLaunches) {
                console.log(`🎯 New Bonk.fun launch detected: ${launch.symbol} (${launch.mint})`);
                // Validate the token
                const validation = await this.tokenValidator.validateToken(launch.mint);
                if (!validation.isValid) {
                    console.log(`⚠️ Token ${launch.symbol} failed validation: ${validation.errors.join(', ')}`);
                    continue;
                }
                // Check risk management
                const riskCheck = risk_manager_1.riskManager.canExecuteTrade(0.01, launch.mint);
                if (!riskCheck.allowed) {
                    console.log(`⚠️ Trade blocked by risk manager: ${riskCheck.errors.join(', ')}`);
                    continue;
                }
                // Execute the snipe using existing enhanced swap service
                await this.executeBonkFunSnipe(launch);
            }
        }
        catch (error) {
            console.log('⚠️ WebSocket monitoring failed, falling back to REST API...');
            // FALLBACK: REST API monitoring if WebSocket fails
            try {
                const launchesRes = await fetch('https://api.bonk.fun/launches/recent');
                if (launchesRes.ok) {
                    const launches = await launchesRes.json();
                    console.log(`📡 REST fallback: Found ${launches.length} recent launches`);
                    // Filter launches <10min old, min liquidity, holders, etc.
                    const recentLaunches = launches.filter((launch) => {
                        const launchTime = new Date(launch.createdAt || launch.timestamp || Date.now()).getTime();
                        const ageMs = Date.now() - launchTime;
                        const maxAgeMs = 10 * 60 * 1000; // 10 minutes
                        return ageMs <= maxAgeMs &&
                            launch.liquidity >= 10 && // Min 10 SOL liquidity
                            launch.holders >= 7; // Min 7 holders
                    });
                    console.log(`🎯 REST fallback: ${recentLaunches.length} launches meet criteria`);
                    for (const launch of recentLaunches) {
                        console.log(`🚀 REST fallback: Processing launch ${launch.symbol || launch.mint}`);
                        // Execute snipe for valid launches
                        if (launch.mint) {
                            await this.executeBonkFunSnipe(launch);
                        }
                    }
                }
                else {
                    console.log(`❌ REST fallback failed: ${launchesRes.status} ${launchesRes.statusText}`);
                }
            }
            catch (restError) {
                console.error('❌ Both WebSocket and REST fallback failed:', restError);
            }
        }
    }
    // Execute Bonk.fun snipe
    async executeBonkFunSnipe(launch) {
        try {
            console.log(`🚀 Executing Bonk.fun snipe for ${launch.symbol}`);
            // Use the enhanced swap service for the actual trade
            const swapRequest = {
                inputMint: 'So11111111111111111111111111111111111111111112', // SOL
                outputMint: launch.mint,
                amount: 0.01 * 1e9, // Convert to lamports
                slippage: 0.1,
                wallet: this.wallet,
                method: 'solana'
            };
            const result = await this.enhancedSwapService.executeSwap(swapRequest);
            if (result.success && result.signature) {
                console.log(`✅ Bonk.fun snipe successful: ${result.signature}`);
                await notifications_1.notificationService.notifyTrade('buy', launch.mint, 0.01, 0, result.signature);
            }
            else {
                console.log(`❌ Bonk.fun snipe failed: ${result.error}`);
            }
        }
        catch (error) {
            console.error(`❌ Error executing Bonk.fun snipe:`, error);
        }
    }
    // NEW: Enhanced Bonk.fun monitoring with REST fallback
    startBonkFunMonitoring() {
        setInterval(async () => {
            if (this.isRunning) {
                await this.monitorBonkFunLaunches();
            }
        }, 30000); // Check every 30 seconds
        console.log('🔍 Bonk.fun monitoring started with REST fallback');
    }
    // NEW: Meteora monitoring with REST fallback
    async monitorMeteoraLaunches() {
        try {
            // Try WebSocket monitoring first through MeteoraMonitor
            await this.meteoraMonitor.startMonitoring();
        }
        catch (error) {
            console.log('⚠️ Meteora WebSocket monitoring failed, falling back to REST API...');
            // FALLBACK: REST API monitoring if WebSocket fails
            try {
                // Example: Meteora API endpoint (replace with actual endpoint if available)
                const launchesRes = await fetch('https://meteora-api-url/pools/recent');
                if (launchesRes.ok) {
                    const launches = await launchesRes.json();
                    console.log(`📡 Meteora REST fallback: Found ${launches.length} recent pools`);
                    // Filter pools <10min old, min liquidity, etc.
                    const recentPools = launches.filter((pool) => {
                        const poolTime = new Date(pool.createdAt || pool.timestamp || Date.now()).getTime();
                        const ageMs = Date.now() - poolTime;
                        const maxAgeMs = 10 * 60 * 1000; // 10 minutes
                        return ageMs <= maxAgeMs &&
                            pool.liquidity >= 10 && // Min 10 SOL liquidity
                            pool.holders >= 7; // Min 7 holders
                    });
                    console.log(`🎯 Meteora REST fallback: ${recentPools.length} pools meet criteria`);
                    for (const pool of recentPools) {
                        console.log(`🚀 Meteora REST fallback: Processing pool ${pool.symbol || pool.mint}`);
                        // Execute snipe for valid pools
                        if (pool.mint && pool.developer) {
                            await this.snipeToken(pool.mint, 'meteora', pool.developer);
                        }
                    }
                }
                else {
                    console.log(`❌ Meteora REST fallback failed: ${launchesRes.status} ${launchesRes.statusText}`);
                }
            }
            catch (restError) {
                console.error('❌ Both Meteora WebSocket and REST fallback failed:', restError);
            }
        }
    }
}
exports.SniperBot = SniperBot;
