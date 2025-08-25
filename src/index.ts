import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { SniperBot } from './sniper-bot';
import { LetsBonkSDK } from './letsbonk-sdk';
import { WalletLoader } from './services/wallet-loader';
import fs from 'fs';

console.log('📁 SBSniper index.ts loaded');

async function main() {
  console.log('🚀 Starting SBSniper bot...');
  
  // Load configuration from config.json
  let config;
  try {
    const configData = fs.readFileSync('./config.json', 'utf8');
    config = JSON.parse(configData);
    console.log('✅ Configuration loaded from config.json');
  } catch (error) {
    console.error('❌ Error loading config.json:', error);
    process.exit(1);
  }
  
  // Setup connection using user's RPC URL
  const connection = new Connection(config.solanaRpcUrl, 'confirmed');
  console.log('✅ Solana connection established');
  
  // SECURITY: Load wallet securely using wallet loader helper
  let keypair;
  try {
    keypair = WalletLoader.loadFromPrivateKey(config.privateKey);
    
    // SECURITY: Validate wallet without exposing secrets
    if (!WalletLoader.validateWallet(keypair)) {
      throw new Error('Invalid wallet structure');
    }
  } catch (error) {
    // SECURITY: Sanitized error logging - no secret exposure
    console.error('❌ Error loading wallet:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
  
  try {
    // Use the enhanced SniperBot with user's target developers
    const targetDevelopers = config.targetDevelopers?.map((dev: any) => dev.address) || [];
    console.log(`🎯 Target developers loaded: ${targetDevelopers.length} addresses`);
    
    // Create LetsBonkSDK instance with wallet
    const sdk = new LetsBonkSDK(connection, keypair);
    
    const bot = new SniperBot(connection, keypair, sdk, targetDevelopers);
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
    } catch (error) {
      console.error('❌ Error in bot operation:', error);
      await bot.stop();
      process.exit(1);
    }
    
    // Keep the script running
    console.log('🔄 Bot is running, waiting for events...');
    await new Promise(() => { });
    
  } catch (error) {
    console.error('❌ Error initializing bot:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});