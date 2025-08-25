const fs = require('fs');

console.log('🧪 Testing configuration loading...');

try {
  // Load configuration from config.json
  const configData = fs.readFileSync('./config.json', 'utf8');
  const config = JSON.parse(configData);
  console.log('✅ Configuration loaded from config.json');
  console.log('RPC URL:', config.solanaRpcUrl);
  console.log('Buy Amount:', config.buyAmountSol);
  console.log('Target Developers:', config.targetDevelopers?.length || 0);
  
  // Test wallet loading
  const secretKey = Uint8Array.from(config.privateKey);
  console.log('✅ Private key loaded, length:', secretKey.length);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log('✅ Configuration test passed!');
