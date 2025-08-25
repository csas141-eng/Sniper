import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { SniperBot } from './sniper-bot';
import { LetsBonkSDK } from './letsbonk-sdk';
import fs from 'fs';
import { WalletSecurity } from './services/wallet-security';
import { rpcEndpointValidator } from './services/rpc-endpoint-validator';
import { addressBlacklist } from './services/address-blacklist';
import { transactionAnomalyMonitor } from './services/transaction-anomaly-monitor';
import { userConfirmationService } from './services/user-confirmation';
import { createBalanceValidator } from './services/balance-validator';

console.log('📁 SBSniper index.ts loaded');

async function main() {
  console.log('🚀 Starting SBSniper bot with enhanced security...');
  
  // Display security warning
  console.log('\n' + '='.repeat(60));
  console.log('🚨 SECURITY NOTICE');
  console.log('='.repeat(60));
  console.log('⚠️  This bot handles cryptocurrency transactions');
  console.log('⚠️  Only use trusted RPC endpoints');
  console.log('⚠️  Be aware of phishing attempts and fake websites');
  console.log('⚠️  Never share your private keys or wallet files');
  console.log('⚠️  Use dedicated wallets with limited funds for trading');
  console.log('='.repeat(60) + '\n');
  
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
  
  // Validate RPC endpoint security
  console.log('🔍 Validating RPC endpoint security...');
  try {
    const rpcValidation = await rpcEndpointValidator.validateEndpoint(config.solanaRpcUrl);
    
    if (!rpcValidation.isValid) {
      console.error('❌ RPC endpoint validation failed:');
      rpcValidation.warnings.forEach(warning => console.error(`   ⚠️  ${warning}`));
      
      // Require user confirmation for unsafe endpoints
      const confirmResult = await userConfirmationService.requestConfirmation(
        'unsafe_rpc_endpoint',
        { endpoint: config.solanaRpcUrl, warnings: rpcValidation.warnings },
        { riskLevel: 'high', factors: rpcValidation.warnings, recommendations: rpcValidation.recommendations, autoConfirm: false }
      );
      
      if (!confirmResult.confirmed) {
        console.log('❌ User rejected unsafe RPC endpoint. Exiting...');
        process.exit(1);
      }
    } else if (!rpcValidation.isOfficial) {
      console.log('⚠️  Using non-official RPC endpoint');
      rpcValidation.recommendations.forEach(rec => console.log(`   💡 ${rec}`));
    } else {
      console.log('✅ RPC endpoint validated successfully');
    }
  } catch (error) {
    console.error('❌ RPC validation error:', error);
    process.exit(1);
  }
  
  // Setup connection using validated RPC URL
  const connection = new Connection(config.solanaRpcUrl, 'confirmed');
  console.log('✅ Solana connection established');
  
  // Create balance validator
  const balanceValidator = createBalanceValidator(connection);
  
  // Load wallet securely
  let keypair;
  try {
    console.log('🔐 Loading wallet securely...');
    
    // Check if encrypted wallet exists
    const walletPath = './my-wallet.json';
    const encryptedWalletPath = './my-wallet.encrypted.json';
    
    if (fs.existsSync(encryptedWalletPath)) {
      // Load encrypted wallet with password prompt
      keypair = await WalletSecurity.loadWalletSecurely(encryptedWalletPath);
      console.log('✅ Encrypted wallet loaded successfully');
    } else if (fs.existsSync(walletPath)) {
      // Legacy plain wallet - offer conversion
      console.log('⚠️  Found plain wallet. Converting to encrypted format...');
      
      const confirmConversion = await userConfirmationService.requestConfirmation(
        'convert_wallet_encryption',
        { walletPath },
        { riskLevel: 'medium', factors: ['Plain text wallet found'], recommendations: ['Convert to encrypted format for security'], autoConfirm: false }
      );
      
      if (confirmConversion.confirmed) {
        await WalletSecurity.convertPlainWallet(walletPath, encryptedWalletPath);
        keypair = await WalletSecurity.loadWalletSecurely(encryptedWalletPath);
        console.log('💡 Consider deleting the plain wallet file: rm my-wallet.json');
      } else {
        // Fallback to plain wallet with warning
        console.log('⚠️  Loading plain wallet (security risk)');
        keypair = await WalletSecurity.loadWalletSecurely(walletPath);
      }
    } else if (config.privateKey && config.privateKey !== 'privatekey') {
      // Legacy config-based private key
      console.log('⚠️  Loading wallet from config (security risk)');
      const secretKey = Uint8Array.from(config.privateKey);
      keypair = Keypair.fromSecretKey(secretKey);
      
      // Recommend encryption
      console.log('💡 Recommendation: Convert to encrypted wallet for better security');
      console.log('   Run: node -e "const {WalletSecurity} = require(\'./dist/services/wallet-security\'); WalletSecurity.convertPlainWallet(\'./my-wallet.json\', \'./my-wallet.encrypted.json\')"');
    } else {
      throw new Error('No wallet found. Please create a wallet first.');
    }
    
    console.log('✅ Wallet loaded successfully');
  } catch (error) {
    console.error('❌ Error loading wallet:', error);
    console.log('💡 To create a new encrypted wallet, run: node generate-wallet.js');
    process.exit(1);
  }
  
  console.log('Wallet public key:', keypair.publicKey.toBase58());
  
  // Validate wallet balance and warn about high-value wallets
  try {
    const walletBalance = await balanceValidator.getSOLBalance(keypair.publicKey.toBase58());
    console.log(`💰 Wallet balance: ${walletBalance} SOL`);
    
    if (walletBalance > 10) {
      console.log('⚠️  HIGH-VALUE WALLET DETECTED');
      const confirmHighValue = await userConfirmationService.requestConfirmation(
        'high_value_wallet_trading',
        { balance: walletBalance, address: keypair.publicKey.toBase58() },
        { 
          riskLevel: 'high', 
          factors: ['High-value wallet being used for trading'], 
          recommendations: ['Use a dedicated trading wallet with limited funds', 'Transfer excess funds to a secure wallet'], 
          autoConfirm: false 
        }
      );
      
      if (!confirmHighValue.confirmed) {
        console.log('❌ User rejected high-value wallet trading. Exiting...');
        process.exit(1);
      }
    }
  } catch (error) {
    console.log('⚠️  Could not validate wallet balance:', error);
  }
  
  try {
    // Use the enhanced SniperBot with user's target developers
    const targetDevelopers = config.targetDevelopers?.map((dev: any) => dev.address) || [];
    console.log(`🎯 Target developers loaded: ${targetDevelopers.length} addresses`);
    
    // Validate target developers against blacklist
    if (targetDevelopers.length > 0) {
      const validation = addressBlacklist.validateAddresses(targetDevelopers);
      
      if (validation.blacklisted.length > 0) {
        console.error('❌ Blacklisted developers detected:');
        validation.blacklisted.forEach(item => {
          console.error(`   🚫 ${item.address}: ${item.entry.reason}`);
        });
        
        const confirmBlacklisted = await userConfirmationService.requestConfirmation(
          'blacklisted_developers',
          { blacklisted: validation.blacklisted },
          { riskLevel: 'critical', factors: ['Blacklisted developers in target list'], recommendations: ['Remove blacklisted developers', 'Review developer list'], autoConfirm: false }
        );
        
        if (!confirmBlacklisted.confirmed) {
          console.log('❌ User rejected blacklisted developers. Exiting...');
          process.exit(1);
        }
      }
    }
    
    // Create LetsBonkSDK instance with wallet
    const sdk = new LetsBonkSDK(connection, keypair);
    
    const bot = new SniperBot(connection, keypair, sdk, targetDevelopers);
    console.log('✅ Enhanced SniperBot initialized with security features');
    
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