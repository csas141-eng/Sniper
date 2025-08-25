const { rateLimiter } = require('./dist/services/rateLimiter');

console.log('🧪 Testing Rate Limiter...');

async function testRateLimiter() {
  console.log('📊 Initial stats:', rateLimiter.getStats());
  
  // Test basic rate limiting
  console.log('⏳ Testing basic rate limiting...');
  const startTime = Date.now();
  
  // Make 5 requests quickly
  for (let i = 0; i < 5; i++) {
    await rateLimiter.waitForRateLimit('testMethod');
    console.log(`✅ Request ${i + 1} allowed`);
    rateLimiter.releaseConnection();
  }
  
  const endTime = Date.now();
  console.log(`⏱️ 5 requests took ${endTime - startTime}ms`);
  
  console.log('📊 Final stats:', rateLimiter.getStats());
  console.log('✅ Rate limiter test completed!');
}

testRateLimiter().catch(console.error);