const { Connection } = require('@solana/web3.js');

console.log('🧪 Testing service instantiation...');

try {
  // Test basic connection
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  console.log('✅ Connection created successfully');
  
  // Test service imports
  console.log('📦 Testing service imports...');
  
  try {
    const { EnhancedSwapService } = require('./dist/services/enhanced-swap');
    console.log('✅ EnhancedSwapService imported');
    
    const service = new EnhancedSwapService(connection);
    console.log('✅ EnhancedSwapService instantiated');
  } catch (error) {
    console.error('❌ EnhancedSwapService failed:', error.message);
  }
  
  try {
    const { TokenValidator } = require('./dist/services/token-validator');
    console.log('✅ TokenValidator imported');
    
    const validator = new TokenValidator(connection);
    console.log('✅ TokenValidator instantiated');
  } catch (error) {
    console.error('❌ TokenValidator failed:', error.message);
  }
  
  try {
    const { BonkFunIntegration } = require('./dist/services/bonk-fun-integration');
    console.log('✅ BonkFunIntegration imported');
    
    const bonk = new BonkFunIntegration(connection);
    console.log('✅ BonkFunIntegration instantiated');
  } catch (error) {
    console.error('❌ BonkFunIntegration failed:', error.message);
  }
  
  try {
    const { ProfitTaker } = require('./dist/services/profit-taker');
    console.log('✅ ProfitTaker imported');
    
    const profit = new ProfitTaker(connection);
    console.log('✅ ProfitTaker instantiated');
  } catch (error) {
    console.error('❌ ProfitTaker failed:', error.message);
  }
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
}
