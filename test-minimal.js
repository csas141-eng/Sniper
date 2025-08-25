console.log('🧪 Testing minimal functionality...');

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
  
  console.log('✅ All basic functionality working!');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
}
