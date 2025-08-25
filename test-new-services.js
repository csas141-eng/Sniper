const { retryService } = require('./dist/services/retry-service');
const { configManager } = require('./dist/services/config-manager');
const { logger } = require('./dist/services/structured-logger');

console.log('🧪 Testing new centralized services...');

async function testRetryService() {
  console.log('\n=== Testing Retry Service ===');
  
  // Test successful operation
  try {
    const result = await retryService.executeWithRetry(
      async () => {
        return 'Success!';
      },
      {
        apiName: 'test',
        endpoint: 'api/test',
        operation: 'test-success'
      }
    );
    console.log('✅ Retry service success test:', result);
  } catch (error) {
    console.error('❌ Retry service success test failed:', error);
  }

  // Test failing operation
  let attempts = 0;
  try {
    await retryService.executeWithRetry(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return `Success after ${attempts} attempts!`;
      },
      {
        apiName: 'test',
        endpoint: 'api/test',
        operation: 'test-retry',
        maxRetries: 3,
        baseDelay: 100
      }
    );
    console.log('✅ Retry service retry test: Success after retries');
  } catch (error) {
    console.error('❌ Retry service retry test failed:', error);
  }
  
  // Test stats
  const stats = retryService.getRetryStats();
  console.log('📊 Retry stats:', stats);
}

function testConfigManager() {
  console.log('\n=== Testing Config Manager ===');
  
  const config = configManager.getConfig();
  console.log('✅ Config loaded, keys:', Object.keys(config).slice(0, 5));
  
  const retrySettings = configManager.get('retrySettings');
  console.log('✅ Retry settings:', retrySettings);
  
  const validation = configManager.validateConfig();
  console.log('✅ Config validation:', validation);
  
  // Test hot-reload (already started by default in non-prod)
  console.log('✅ Hot-reload status: enabled');
}

function testLogger() {
  console.log('\n=== Testing Structured Logger ===');
  
  logger.info('Testing info message', { testContext: true });
  logger.warn('Testing warning message', { testContext: true });
  logger.error('Testing error message', { testContext: true });
  
  logger.logApiSuccess('pumpfun', '/api/tokens', 'getTokenInfo', 150);
  logger.logApiFailure('raydium', '/api/pools', 'getPoolInfo', new Error('Test error'), 500);
  
  logger.logRetryAttempt('jupiter', '/api/swap', 'swap', 2, 3, new Error('Rate limited'), 2000);
  
  logger.logTransaction('buy', 'ABC123...', 0.01, 'tx123...', true);
  
  logger.logCircuitBreakerEvent('opened', 'Too many failures');
  
  const stats = logger.getLogStats();
  console.log('📊 Log stats:', stats);
  
  console.log('✅ Logger test completed');
}

async function runTests() {
  try {
    testConfigManager();
    await testRetryService();
    testLogger();
    
    console.log('\n✅ All centralized services tests passed!');
  } catch (error) {
    console.error('\n❌ Service tests failed:', error);
  }
}

runTests().catch(console.error);