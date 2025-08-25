console.log('🧪 Testing basic object creation...');

try {
  // Test basic imports
  const { Connection, Keypair } = require('@solana/web3.js');
  console.log('✅ Solana web3.js imported');
  
  // Test connection
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  console.log('✅ Connection created');
  
  // Test config loading
  const fs = require('fs');
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  console.log('✅ Config loaded:', config.solanaRpcUrl);
  
  // Test wallet loading
  const secretKey = Uint8Array.from(config.privateKey);
  const keypair = Keypair.fromSecretKey(secretKey);
  console.log('✅ Wallet loaded:', keypair.publicKey.toBase58());
  
  // Test SniperBot import
  const { SniperBot } = require('./dist/sniper-bot');
  console.log('✅ SniperBot imported');
  
  console.log('✅ All basic functionality working!');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
}

