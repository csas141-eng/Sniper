"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BonkFunIntegration = void 0;
const web3_js_1 = require("@solana/web3.js");
const letsbonk_sdk_1 = require("../letsbonk-sdk");
const fs_1 = __importDefault(require("fs"));
// Load configuration from config.json
const loadConfig = () => {
    try {
        const configData = fs_1.default.readFileSync('./config.json', 'utf8');
        const userConfig = JSON.parse(configData);
        return {
            SOLANA_RPC_URL: userConfig.solanaRpcUrl
        };
    }
    catch (error) {
        console.error('Error loading config.json, using defaults:', error);
        return {};
    }
};
const CONFIG = loadConfig();
class BonkFunIntegration {
    connection;
    isInitialized = false;
    letsBonkSDK = null;
    constructor(connection) {
        this.connection = connection;
        this.initializeSDK();
    }
    async initializeSDK() {
        try {
            // Create a temporary wallet for SDK initialization
            const tempWallet = web3_js_1.Keypair.generate();
            this.letsBonkSDK = new letsbonk_sdk_1.LetsBonkSDK(this.connection, tempWallet);
            this.isInitialized = true;
            console.log('✅ Bonk.fun integration with LetsBonkSDK initialized successfully');
        }
        catch (error) {
            console.error('❌ Failed to initialize Bonk.fun integration:', error);
        }
    }
    // Monitor for new token launches on Bonk.fun
    async monitorNewLaunches() {
        if (!this.isInitialized) {
            console.log('⚠️ Bonk.fun integration not initialized');
            return [];
        }
        try {
            // Get recent token launches from Bonk.fun API
            const launches = await this.getRecentLaunches();
            // Filter for new launches (within last 5 minutes)
            const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
            // Patch for: 'launch.launchTime' is possibly 'undefined'
            const newLaunches = launches.filter(launch => (launch.launchTime ?? 0) > fiveMinutesAgo);
            if (newLaunches.length > 0) {
                console.log(`🎯 Found ${newLaunches.length} new Bonk.fun launches`);
                await this.notifyNewLaunches(newLaunches);
            }
            return newLaunches;
        }
        catch (error) {
            console.error('Error monitoring Bonk.fun launches:', error);
            return [];
        }
    }
    // Get recent token launches from Bonk.fun API
    async getRecentLaunches() {
        try {
            // Use Bonk.fun API to get real launches
            const response = await fetch('https://api.bonk.fun/launches/recent');
            if (!response.ok) {
                throw new Error(`Bonk.fun API error: ${response.status}`);
            }
            const data = await response.json();
            return data.launches || [];
        }
        catch (error) {
            console.error('Error getting recent launches:', error);
            return [];
        }
    }
    // Execute buy on new token launch
    async buyNewToken(launch, wallet, amount) {
        if (!this.isInitialized || !this.letsBonkSDK) {
            return { success: false, error: 'Bonk.fun integration not initialized' };
        }
        try {
            console.log(`🚀 Buying ${launch.symbol} (${launch.mint}) on Bonk.fun using real SDK`);
            // Convert SOL amount to lamports
            const buyAmountLamports = BigInt(Math.floor(amount * 1e9));
            const mintPubkey = new web3_js_1.PublicKey(launch.mint);
            // Use the actual LetsBonkSDK for real trading
            const result = await this.letsBonkSDK.buy(wallet, mintPubkey, buyAmountLamports, BigInt(0) // minimum out - could be calculated based on slippage
            );
            if (result.success && result.data?.signature) {
                console.log(`✅ Successfully bought ${launch.symbol} for ${amount} SOL, signature: ${result.data.signature}`);
                return {
                    success: true,
                    signature: result.data.signature
                };
            }
            else {
                return {
                    success: false,
                    error: 'Buy operation failed through SDK'
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Failed to buy ${launch.symbol}:`, errorMessage);
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    // Get token information
    async getTokenInfo(mint) {
        if (!this.isInitialized) {
            return null;
        }
        try {
            // Use Bonk.fun API to get token info
            const response = await fetch(`https://api.bonk.fun/token/${mint}`);
            if (!response.ok) {
                return null;
            }
            return await response.json();
        }
        catch (error) {
            console.error('Error getting token info:', error);
            return null;
        }
    }
    // Check if token is on Bonk.fun
    async isTokenOnBonkFun(mint) {
        try {
            const tokenInfo = await this.getTokenInfo(mint);
            return tokenInfo !== null;
        }
        catch (error) {
            return false;
        }
    }
    // Notify about new launches
    async notifyNewLaunches(launches) {
        for (const launch of launches) {
            // Notify about new launch - temporarily disabled due to service dependencies
            console.log(`💰 New launch notification temporarily disabled - implement with proper service dependencies`);
        }
    }
}
exports.BonkFunIntegration = BonkFunIntegration;
// Service instance will be created by SniperBot
