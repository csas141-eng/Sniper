const { SniperBot } = require('./dist/sniper-bot');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { LetsBonkSDK } = require('./dist/letsbonk-sdk');
const { circuitBreaker } = require('./dist/services/circuit-breaker');

console.log('🧪 Testing SniperBot getExtendedStatus() method...\n');

async function testGetExtendedStatus() {
  try {
    // Create test connection and wallet
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const wallet = Keypair.generate();
    const sdk = new LetsBonkSDK(connection, wallet);
    
    // Create test developers array
    const testDevelopers = [
      'So11111111111111111111111111111111111111112', // SOL mint as example
      '11111111111111111111111111111111' // System program as example
    ];
    
    // Initialize SniperBot
    const sniperBot = new SniperBot(connection, wallet, sdk, testDevelopers);
    
    console.log('✅ SniperBot initialized successfully');
    
    // Test getExtendedStatus method
    console.log('📊 Testing getExtendedStatus() method...');
    const status = sniperBot.getExtendedStatus();
    
    // Validate the status object structure
    console.log('🔍 Validating status object structure...');
    
    // Check required properties
    const requiredProps = [
      'isRunning', 'wallet', 'connections', 'circuitBreaker', 
      'monitoring', 'platforms', 'lastUpdate'
    ];
    
    for (const prop of requiredProps) {
      if (!(prop in status)) {
        throw new Error(`Missing required property: ${prop}`);
      }
    }
    console.log('✅ All required properties present');
    
    // Validate wallet information
    if (!status.wallet.address || typeof status.wallet.address !== 'string') {
      throw new Error('Invalid wallet address');
    }
    console.log(`✅ Wallet address: ${status.wallet.address.substring(0, 8)}...`);
    
    // Validate connections
    if (!status.connections.rpc || typeof status.connections.rpc !== 'string') {
      throw new Error('Invalid RPC connection');
    }
    console.log(`✅ RPC endpoint: ${status.connections.rpc}`);
    
    // Validate circuit breaker status
    if (typeof status.circuitBreaker.enabled !== 'boolean') {
      throw new Error('Invalid circuit breaker enabled flag');
    }
    console.log(`✅ Circuit breaker enabled: ${status.circuitBreaker.enabled}`);
    
    // Validate monitoring stats
    if (typeof status.monitoring.activeSnipes !== 'number' ||
        typeof status.monitoring.totalTrades !== 'number' ||
        typeof status.monitoring.successfulTrades !== 'number') {
      throw new Error('Invalid monitoring statistics');
    }
    console.log('✅ Monitoring statistics valid');
    
    // Validate platforms
    const platforms = ['pumpfun', 'raydium', 'bonkfun', 'meteora'];
    for (const platform of platforms) {
      if (!(platform in status.platforms) || typeof status.platforms[platform] !== 'boolean') {
        throw new Error(`Invalid platform status for: ${platform}`);
      }
    }
    console.log('✅ Platform statuses valid');
    
    // Validate timestamp
    const timestamp = new Date(status.lastUpdate);
    if (isNaN(timestamp.getTime())) {
      throw new Error('Invalid timestamp');
    }
    console.log(`✅ Last update timestamp: ${status.lastUpdate}`);
    
    // Print the full status for inspection
    console.log('\n📋 Complete Extended Status:');
    console.log('=====================================');
    console.log('Bot Running:', status.isRunning);
    console.log('Wallet:', status.wallet.address.substring(0, 12) + '...');
    console.log('RPC:', status.connections.rpc);
    console.log('Circuit Breaker:');
    console.log('  - Enabled:', status.circuitBreaker.enabled);
    console.log('  - Open:', status.circuitBreaker.isOpen);
    console.log('  - Daily Loss:', status.circuitBreaker.dailyLoss, 'SOL');
    console.log('  - Daily Trades:', status.circuitBreaker.dailyTrades);
    console.log('  - Consecutive Failures:', status.circuitBreaker.consecutiveFailures);
    console.log('Monitoring:');
    console.log('  - Active Snipes:', status.monitoring.activeSnipes);
    console.log('  - Total Trades:', status.monitoring.totalTrades);
    console.log('  - Successful Trades:', status.monitoring.successfulTrades);
    console.log('Platforms:');
    console.log('  - PumpFun:', status.platforms.pumpfun ? '✅' : '❌');
    console.log('  - Raydium:', status.platforms.raydium ? '✅' : '❌');
    console.log('  - BonkFun:', status.platforms.bonkfun ? '✅' : '❌');
    console.log('  - Meteora:', status.platforms.meteora ? '✅' : '❌');
    console.log('Last Update:', status.lastUpdate);
    
    console.log('\n✅ getExtendedStatus() test passed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

async function testCircuitBreakerCallbacks() {
  console.log('\n🧪 Testing Circuit Breaker Callbacks...\n');
  
  try {
    let callbackCalled = false;
    let callbackState = '';
    let callbackReason = '';
    
    // Register a test callback
    const testCallback = (state, reason) => {
      callbackCalled = true;
      callbackState = state;
      callbackReason = reason || '';
      console.log(`📞 Callback triggered: ${state} - ${reason}`);
    };
    
    circuitBreaker.onStateChange(testCallback);
    console.log('✅ Registered state change callback');
    
    // Reset circuit breaker for clean test
    circuitBreaker.reset();
    console.log('✅ Reset circuit breaker');
    
    // Record a large loss to trigger circuit breaker
    circuitBreaker.recordTrade({
      success: false,
      tokenMint: 'TEST123...',
      amount: 0.1,
      profitLoss: -0.8, // Large loss to trigger circuit breaker
      timestamp: new Date()
    });
    
    // Give a moment for async callback execution
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!callbackCalled) {
      throw new Error('State change callback was not called');
    }
    
    if (callbackState !== 'opened') {
      throw new Error(`Expected callback state 'opened', got '${callbackState}'`);
    }
    
    console.log('✅ State change callback triggered successfully');
    console.log(`✅ Callback received state: ${callbackState}, reason: ${callbackReason}`);
    
    // Remove the callback
    circuitBreaker.removeStateChangeCallback(testCallback);
    console.log('✅ Removed state change callback');
    
    console.log('\n✅ Circuit breaker callback test passed!');
    
  } catch (error) {
    console.error('❌ Circuit breaker callback test failed:', error.message);
    throw error;
  }
}

async function runAllTests() {
  try {
    await testGetExtendedStatus();
    await testCircuitBreakerCallbacks();
    
    console.log('\n🎉 All SniperBot status and circuit breaker tests passed!');
    console.log('\n📊 Summary:');
    console.log('- ✅ getExtendedStatus() method works correctly');
    console.log('- ✅ Returns comprehensive bot status information');
    console.log('- ✅ Circuit breaker callback hooks functional');
    console.log('- ✅ All data structures properly typed and validated');
    
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
  }
}

runAllTests().catch(console.error);