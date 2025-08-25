# Rate Limiting Implementation for Solana RPC Calls

## Overview

This implementation adds comprehensive rate limiting for Solana mainnet RPC usage according to Chainstack's public node limits. The rate limiter ensures compliance with all three key limits while providing robust error handling and connection management.

## Chainstack Public Node Limits

The implementation enforces the following Chainstack limits:

1. **Maximum 100 HTTP requests per 10 seconds** (all methods combined)
2. **Maximum 40 calls to the same RPC method per 10 seconds**
3. **Maximum 40 simultaneous connections**

## Configuration Changes

### Updated Endpoints

The configuration has been updated to use the new Chainstack mainnet endpoints:

- **HTTPS RPC**: `https://solana-mainnet.core.chainstack.com/d957d9f011a51a960a42e5b247223dd4`
- **WebSocket**: `wss://solana-mainnet.core.chainstack.com/d957d9f011a51a960a42e5b247223dd4`

### Configuration Files Updated

1. **config.json**: Updated `solanaRpcUrl` and added `solanaWsUrl`
2. **src/services/enhanced-swap.ts**: Updated default fallback URL
3. **src/sniper-bot.ts**: Updated default fallback URL

## Rate Limiter Service

### Location
`src/services/rateLimiter.ts`

### Key Features

#### 1. Sliding Window Rate Limiting
- Uses timestamps to track requests in a 10-second sliding window
- Automatically cleans up old timestamps to prevent memory leaks
- Separate tracking for per-method and global limits

#### 2. Connection Pool Management  
- Tracks active connections (max 40 simultaneous)
- Queues requests when connection limit is reached
- Automatically processes queued requests when slots become available

#### 3. Method-Specific Tracking
- Tracks each RPC method separately (e.g., 'getAccountInfo', 'getBalance')
- Enforces 40 calls per method per 10 seconds limit
- Provides detailed statistics for monitoring

### Usage Examples

#### Basic Usage
```typescript
import { rateLimiter } from './services/rateLimiter';

// Wait for rate limit compliance before making RPC call
await rateLimiter.waitForRateLimit('getAccountInfo');
try {
  const result = await connection.getAccountInfo(publicKey);
  return result;
} finally {
  // Always release connection when done
  rateLimiter.releaseConnection();
}
```

#### Using the Helper Method
```typescript
import { rateLimiter } from './services/rateLimiter';

// Automatic rate limiting and connection management
const result = await rateLimiter.executeRpcCall(
  connection,
  'getAccountInfo',
  () => connection.getAccountInfo(publicKey)
);
```

## Implementation Details

### Rate Limiting Algorithm

1. **Request Arrival**: When a request arrives, check available connection slots
2. **Connection Queuing**: If no slots available, queue the request
3. **Window Cleanup**: Remove timestamps older than 10 seconds
4. **Method Limit Check**: Verify method-specific limit (40 calls per method)
5. **Global Limit Check**: Verify global limit (100 calls total)
6. **Wait Calculation**: If limits exceeded, calculate wait time and delay
7. **Request Tracking**: Add current timestamp to tracking maps
8. **Connection Reservation**: Reserve a connection slot
9. **Execution**: Execute the RPC call
10. **Connection Release**: Release the connection slot when complete

### Memory Management

- **Automatic Cleanup**: Old timestamps are removed every 30 seconds
- **Sliding Window**: Only timestamps within the 10-second window are kept
- **Empty Map Cleanup**: Empty method entries are removed to prevent memory leaks

### Error Handling

- **Connection Release**: Connections are always released, even on errors
- **Retry Logic**: Enhanced retry logic in `executeWithRetry` function
- **Queue Management**: Queued requests are processed in FIFO order

## Integration Points

### Enhanced Swap Service
- Updated to use the new rate limiter service
- All RPC calls go through `executeWithRetry` with rate limiting
- Connection management is handled automatically

### Pool Monitor Service  
- Added rate limiter import for future integration
- Ready for RPC call wrapping with rate limiting

### Other Services
- All services making RPC calls should import and use the rate limiter
- Use `rateLimiter.executeRpcCall()` for automatic management
- Or use manual `waitForRateLimit()` + `releaseConnection()` pattern

## Monitoring and Statistics

### Available Statistics
```typescript
const stats = rateLimiter.getStats();
console.log(stats);
// Output:
// {
//   activeConnections: 5,
//   queuedRequests: 2,
//   recentRequests: {
//     'getAccountInfo': 25,
//     'getBalance': 15,
//     'general': 40
//   }
// }
```

### Logging
- Rate limit warnings are logged with wait times
- Connection limit warnings show current usage
- Method-specific limit warnings show which method hit the limit

## Testing

### Rate Limiter Test
Run `node test-rate-limiter.js` to test basic functionality.

### Configuration Test  
Run `node test-config.js` to verify configuration loading with new endpoints.

## Best Practices for Developers

### 1. Always Release Connections
```typescript
// ✅ Good
await rateLimiter.waitForRateLimit('method');
try {
  const result = await operation();
  return result;
} finally {
  rateLimiter.releaseConnection();
}

// ❌ Bad - connection never released
await rateLimiter.waitForRateLimit('method');
const result = await operation();
return result;
```

### 2. Use Specific Method Names
```typescript
// ✅ Good - specific method names for better tracking
await rateLimiter.waitForRateLimit('getAccountInfo');
await rateLimiter.waitForRateLimit('getBalance');
await rateLimiter.waitForRateLimit('sendTransaction');

// ❌ Less optimal - generic names don't provide method-specific limiting
await rateLimiter.waitForRateLimit('general');
```

### 3. Use Helper Methods When Possible
```typescript
// ✅ Preferred - automatic connection management
const result = await rateLimiter.executeRpcCall(
  connection,
  'getAccountInfo',
  () => connection.getAccountInfo(key)
);
```

### 4. Monitor Statistics in Production
```typescript
// Log statistics periodically for monitoring
setInterval(() => {
  const stats = rateLimiter.getStats();
  if (stats.activeConnections > 30 || stats.queuedRequests > 10) {
    console.warn('🚨 High RPC usage detected:', stats);
  }
}, 60000); // Every minute
```

## Future Enhancements

1. **Dynamic Rate Limiting**: Adjust limits based on API response headers
2. **Circuit Breaker**: Temporarily stop requests if error rate is too high
3. **Load Balancing**: Support multiple RPC endpoints with load balancing
4. **Metrics Export**: Export metrics to monitoring systems
5. **Configuration Hot-Reload**: Update limits without restart

## Migration Notes

### For Existing Code
1. Import the rate limiter: `import { rateLimiter } from './services/rateLimiter';`
2. Wrap RPC calls with rate limiting
3. Ensure connection release in finally blocks
4. Update configuration to use new Chainstack endpoints

### Breaking Changes
- Old `RateLimiter` class in `enhanced-swap.ts` has been removed
- All RPC calls should now go through the centralized rate limiter
- Configuration format slightly changed (added `solanaWsUrl`)

This implementation provides a robust, scalable solution for RPC rate limiting that ensures compliance with Chainstack's limits while maintaining high performance and reliability.