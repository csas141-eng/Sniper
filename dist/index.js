"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3_js_1 = require("@solana/web3.js");
const sniper_bot_1 = require("./sniper-bot");
const letsbonk_sdk_1 = require("./letsbonk-sdk");
const fs_1 = __importDefault(require("fs"));
console.log('📁 SBSniper index.ts loaded');
async function main() {
    console.log('🚀 Starting SBSniper bot...');
    // Load configuration from config.json
    let config;
    try {
        const configData = fs_1.default.readFileSync('./config.json', 'utf8');
        config = JSON.parse(configData);
        console.log('✅ Configuration loaded from config.json');
    }
    catch (error) {
        console.error('❌ Error loading config.json:', error);
        process.exit(1);
    }
    // Setup connection using user's RPC URL
    const connection = new web3_js_1.Connection(config.solanaRpcUrl, 'confirmed');
    console.log('✅ Solana connection established');
    // Load wallet from user's private key
    let keypair;
    try {
        const secretKey = Uint8Array.from(config.privateKey);
        keypair = web3_js_1.Keypair.fromSecretKey(secretKey);
        console.log('✅ Wallet loaded successfully');
    }
    catch (error) {
        console.error('❌ Error loading wallet:', error);
        process.exit(1);
    }
    console.log('Wallet public key:', keypair.publicKey.toBase58());
    try {
        // Use the enhanced SniperBot with user's target developers
        const targetDevelopers = config.targetDevelopers?.map((dev) => dev.address) || [];
        console.log(`🎯 Target developers loaded: ${targetDevelopers.length} addresses`);
        // Create LetsBonkSDK instance with wallet
        const sdk = new letsbonk_sdk_1.LetsBonkSDK(connection, keypair);
        const bot = new sniper_bot_1.SniperBot(connection, keypair, sdk, targetDevelopers);
        console.log('✅ Enhanced SniperBot initialized');
        console.log('Starting Enhanced SniperBot...');
        // Setup graceful shutdown
        process.on('SIGINT', async () => {
            console.log('Received SIGINT. Shutting down gracefully...');
            await bot.stop();
            process.exit(0);
        });
        try {
            console.log('🚀 Calling bot.start...');
            await bot.start(config.buyAmountSol, config.slippage);
            console.log('✅ Bot started successfully');
        }
        catch (error) {
            console.error('❌ Error in bot operation:', error);
            await bot.stop();
            process.exit(1);
        }
        // Keep the script running
        console.log('🔄 Bot is running, waiting for events...');
        await new Promise(() => { });
    }
    catch (error) {
        console.error('❌ Error initializing bot:', error);
        process.exit(1);
    }
}
main().catch((error) => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
});
