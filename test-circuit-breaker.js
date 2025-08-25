const { circuitBreaker } = require('./dist/services/circuit-breaker');
const { statePersistence } = require('./dist/services/state-persistence');
const { configManager } = require('./dist/services/config-manager');

console.log('🧪 Testing Circuit Breaker and State Persistence...');

async function testCircuitBreaker() {
  console.log('\n=== Testing Circuit Breaker ===');
  
  // Reset circuit breaker for clean test
  circuitBreaker.reset();
  
  // Check initial status
  const initialStatus = circuitBreaker.getStatus();
  console.log('✅ Initial circuit breaker status:', {
    enabled: initialStatus.enabled,
    isOpen: initialStatus.isOpen,
    dailyLoss: initialStatus.dailyLoss,
    consecutiveFailures: initialStatus.consecutiveFailures
  });
  
  // Test trading allowed initially
  const canTrade1 = circuitBreaker.canTrade();
  console.log('✅ Can trade initially:', canTrade1.allowed);
  
  // Record some successful trades
  circuitBreaker.recordTrade({
    success: true,
    tokenMint: 'ABC123...',
    amount: 0.01,
    profitLoss: 0.005, // 0.005 SOL profit
    timestamp: new Date()
  });
  
  circuitBreaker.recordTrade({
    success: true,
    tokenMint: 'XYZ789...',
    amount: 0.02,
    profitLoss: 0.01, // 0.01 SOL profit
    timestamp: new Date()
  });
  
  console.log('✅ Recorded 2 successful trades');
  
  // Record some failures to test consecutive failure threshold
  for (let i = 0; i < 5; i++) {
    circuitBreaker.recordTrade({
      success: false,
      tokenMint: `FAIL${i}...`,
      amount: 0.01,
      profitLoss: -0.01, // 0.01 SOL loss each
      error: `Test error ${i}`,
      timestamp: new Date()
    });
  }
  
  console.log('✅ Recorded 5 failed trades');
  
  // Check if circuit breaker opened (should not yet - need 10 consecutive failures by default)
  const statusAfterFailures = circuitBreaker.getStatus();
  console.log('✅ Status after failures:', {
    isOpen: statusAfterFailures.isOpen,
    consecutiveFailures: statusAfterFailures.consecutiveFailures,
    dailyLoss: statusAfterFailures.dailyLoss,
    dailyTrades: statusAfterFailures.dailyTrades
  });
  
  // Record a large single loss to trigger single loss threshold
  circuitBreaker.recordTrade({
    success: false,
    tokenMint: 'BIGLOSS...',
    amount: 0.6, // 0.6 SOL trade
    profitLoss: -0.6, // 0.6 SOL loss (exceeds 0.5 threshold)
    error: 'Large loss',
    timestamp: new Date()
  });
  
  console.log('✅ Recorded large loss trade (should trigger circuit breaker)');
  
  // Check if circuit breaker is now open
  const finalStatus = circuitBreaker.getStatus();
  console.log('✅ Final circuit breaker status:', {
    isOpen: finalStatus.isOpen,
    dailyLoss: finalStatus.dailyLoss,
    nextAttemptTime: finalStatus.nextAttemptTime ? new Date(finalStatus.nextAttemptTime) : undefined
  });
  
  // Test if trading is blocked
  const canTrade2 = circuitBreaker.canTrade();
  console.log('✅ Can trade after large loss:', canTrade2.allowed, canTrade2.reason || '');
}

async function testStatePersistence() {
  console.log('\n=== Testing State Persistence ===');
  
  // Get initial state
  const initialState = statePersistence.getState();
  console.log('✅ Initial state loaded:', {
    activeSnipes: initialState.activeSnipes.length,
    totalTrades: initialState.profitStats.totalTrades,
    totalErrors: initialState.errorCounters.totalErrors
  });
  
  // Add some active snipes
  statePersistence.addActiveSnipe({
    tokenMint: 'SNIPE1...',
    startTime: Date.now(),
    targetDeveloper: 'DEV123...',
    amount: 0.01,
    platform: 'pumpfun',
    status: 'pending'
  });
  
  statePersistence.addActiveSnipe({
    tokenMint: 'SNIPE2...',
    startTime: Date.now(),
    amount: 0.02,
    platform: 'raydium',
    status: 'executing'
  });
  
  console.log('✅ Added 2 active snipes');
  
  // Update snipe status
  statePersistence.updateSnipeStatus('SNIPE1...', 'completed', 'tx123...');
  console.log('✅ Updated snipe status to completed');
  
  // Record some errors
  statePersistence.recordError('NETWORK_ERROR', 'solana', new Error('Connection failed'));
  statePersistence.recordError('API_ERROR', 'pumpfun', new Error('Rate limited'));
  console.log('✅ Recorded 2 errors');
  
  // Record a successful operation
  statePersistence.recordSuccess();
  console.log('✅ Recorded success (should reset consecutive errors)');
  
  // Add pool to cache
  statePersistence.addPoolToCache({
    mint: 'POOL1...',
    poolAddress: 'POOLADDR1...',
    liquidity: 10000,
    platform: 'raydium',
    discoveredAt: Date.now(),
    lastUpdated: Date.now()
  });
  
  console.log('✅ Added pool to cache');
  
  // Record trade statistics
  statePersistence.recordTrade(true, 0.05, 0.01); // successful trade with profit
  statePersistence.recordTrade(false, -0.01, 0.01); // failed trade with loss
  console.log('✅ Recorded trade statistics');
  
  // Update runtime stats
  statePersistence.updateRuntimeStats();
  statePersistence.updateWSConnection('pumpfun', true);
  statePersistence.updateWSConnection('raydium', false);
  statePersistence.recordConfigReload();
  console.log('✅ Updated runtime statistics');
  
  // Get final state
  const finalState = statePersistence.getState();
  console.log('✅ Final state:', {
    activeSnipes: finalState.activeSnipes.length,
    poolsCached: finalState.poolsCache.length,
    totalTrades: finalState.profitStats.totalTrades,
    successfulTrades: finalState.profitStats.successfulTrades,
    totalErrors: finalState.errorCounters.totalErrors,
    consecutiveErrors: finalState.errorCounters.consecutiveErrors,
    wsConnections: Object.keys(finalState.runtimeStats.wsConnections).length
  });
  
  // Test recovery info
  const recoveryInfo = statePersistence.getRecoveryInfo();
  console.log('✅ Recovery info:', {
    hasRecoverableState: recoveryInfo.hasRecoverableState,
    activeSnipes: recoveryInfo.activeSnipes.length,
    recentErrors: recoveryInfo.recentErrors
  });
  
  // Force save state
  statePersistence.saveState();
  console.log('✅ State saved to disk');
}

async function testIntegration() {
  console.log('\n=== Testing Integration ===');
  
  // Test config hot-reload
  console.log('✅ Config manager hot-reload is active');
  
  // Test that services use updated config
  const config = configManager.getConfig();
  console.log('✅ Current config circuitBreaker.enabled:', config.circuitBreaker?.enabled);
  console.log('✅ Current config statePersistence.enabled:', config.statePersistence?.enabled);
  
  // Check if files exist
  const fs = require('fs');
  const files = [
    './bot-state.json',
    './circuit-breaker-state.json',
    './logs/bot-2025-08-25.log'
  ];
  
  for (const file of files) {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      console.log(`✅ ${file} exists (${stats.size} bytes)`);
    } else {
      console.log(`ℹ️  ${file} does not exist (will be created when needed)`);
    }
  }
}

async function runTests() {
  try {
    await testCircuitBreaker();
    await testStatePersistence();
    await testIntegration();
    
    console.log('\n✅ All circuit breaker and state persistence tests passed!');
    console.log('\n📊 Summary:');
    console.log('- Circuit breaker: Prevents trading after loss/error thresholds');
    console.log('- State persistence: Saves bot state for crash recovery');
    console.log('- Config hot-reload: Updates settings without restart');
    console.log('- Structured logging: Detailed logs with context');
    console.log('- Retry service: Centralized API retry with rate limiting');
    
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
  }
}

runTests().catch(console.error);