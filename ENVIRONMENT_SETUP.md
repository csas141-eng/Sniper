# Environment Setup Guide

## Required Environment Variables

Create a `.env` file in your project root with the following variables:

### Pump.fun Authentication
```bash
PUMPFUN_AUTH_TOKEN=your_pumpfun_auth_token_here
```

### Platform Configuration
```bash
PLATFORM=pumpfun
```

### Jupiter API Configuration
```bash
JUPITER_API_KEY=your_jupiter_api_key_here
```

### WebSocket Configuration
```bash
WEBSOCKET_RETRY_DELAY=5000
WEBSOCKET_MAX_RETRIES=10
```

### Rate Limiting
```bash
MIN_API_CALL_DELAY=2000
MAX_CONSECUTIVE_FAILURES=5
```

## How to Get API Keys

### Pump.fun
1. Visit https://pump.fun
2. Create an account
3. Go to API settings
4. Generate an authentication token

### Jupiter
1. Visit https://jup.ag
2. Go to developer portal
3. Create an API key

## Testing the Configuration

After setting up the environment variables, test the bot:

```bash
npm run build
npm start
```

The bot should now:
- ✅ Use proper Jupiter API endpoints
- ✅ Implement rate limiting for Raydium API calls
- ✅ Handle WebSocket authentication properly
- ✅ Use Pump.fun direct execution as fallback
