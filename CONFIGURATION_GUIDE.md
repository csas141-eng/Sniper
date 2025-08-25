# 🔧 SBSniper Bot Configuration Guide

## 📋 **Required Configuration**

### **1. Environment Variables**
Create a `.env` file in your project root with:

```bash
# Solana RPC Configuration
SOLANA_RPC_URL=https://solana-mainnet.rpc.extrnode.com

# Wallet Configuration
WALLET_PATH=C:\Users\csas1\Desktop\sbsniper\my-wallet.json

# MEV Protection RPC URLs
JITO_RPC_URL=https://jito-api.mainnet.jito.network
NOZOMI_RPC_URL=https://rpc.nozomi.com

# Notification Services
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
DISCORD_WEBHOOK_URL=your_discord_webhook_url_here
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password_here
EMAIL_TO=recipient@email.com

# Trading Configuration
AMOUNT_TO_BUY=0.00001
SLIPPAGE=0.3
MAX_RETRIES=5
MIN_LIQUIDITY_USD=10000
PRIORITY_FEE=50000

# Risk Management
MAX_DAILY_LOSS=1.0
MAX_SINGLE_LOSS=0.5
TRADE_COOLDOWN=5000
MAX_POSITIONS=5
```

### **2. Telegram Bot Setup**
1. Message `@BotFather` on Telegram
2. Create new bot with `/newbot`
3. Get bot token and chat ID
4. Add to `.env` file

### **3. Discord Webhook Setup**
1. Go to Discord channel settings
2. Create webhook
3. Copy webhook URL
4. Add to `.env` file

### **4. Email Setup (Gmail)**
1. Enable 2FA on Gmail
2. Generate App Password
3. Use App Password in `.env` file

## 🚀 **What's Now Real (No More Placeholders)**

### **✅ Raydium Integration**
- Real pool discovery via Raydium API
- Actual pool keys and market data
- Real liquidity calculations
- Proper swap instruction creation

### **✅ Jupiter Integration**
- Real v6 API endpoints
- Proper transaction building
- Rate limiting and error handling

### **✅ Price Feeds**
- Real SOL price from CoinGecko
- Live token price updates
- Accurate liquidity calculations

### **✅ MEV Protection**
- Real JITO and Nozomi RPCs
- Actual tip accounts
- Proper tip instructions

### **✅ Transaction Validation**
- Pre-flight simulation
- Real-time validation
- Error checking before sending

## 🔍 **Testing Your Configuration**

1. **Check RPC Health:**
   ```bash
   npm run test:rpc
   ```

2. **Test Pool Discovery:**
   ```bash
   npm run test:pools
   ```

3. **Test Price Feeds:**
   ```bash
   npm run test:prices
   ```

4. **Test Notifications:**
   ```bash
   npm run test:notifications
   ```

## ⚠️ **Important Notes**

- **Never commit your `.env` file** - it contains sensitive data
- **Test with small amounts first** - start with 0.00001 SOL
- **Monitor your bot** - use the notification services
- **Keep RPC URLs updated** - some may have rate limits

## 🎯 **Profit-Taking Strategy**

### **Multi-Tier Profit Taking**
Your bot now implements a **sophisticated profit-taking strategy**:

```typescript
PROFIT_TAKING: {
  TIER_1: { percentage: 10.0, amount: 0.35 },  // 1000% profit, sell 35%
  TIER_2: { percentage: 100.0, amount: 0.35 }, // 10000% profit, sell 35%
  KEEP_AMOUNT: 0.30,                           // Keep 30% for moonshot
  ENABLE_AUTO_SELL: true,
  MIN_PROFIT_TO_SELL: 0.5,                     // Minimum 50% profit to start selling
  MAX_HOLD_TIME: 24 * 60 * 60 * 1000           // 24 hours max hold time
}
```

### **How It Works**
1. **Entry**: Buy token with full amount
2. **Tier 1**: When profit reaches **1000% (10x)**, automatically sell **35%**
3. **Tier 2**: When profit reaches **10000% (100x)**, automatically sell another **35%**
4. **Hold**: Keep **30%** for potential moonshot gains

### **Example Scenario**
- **Initial Investment**: 0.00001 SOL
- **Tier 1 Trigger**: Token goes 10x → Sell 35% = **0.000035 SOL profit**
- **Tier 2 Trigger**: Token goes 100x → Sell 35% = **0.00035 SOL profit**
- **Remaining**: 30% of tokens for unlimited upside

### **Benefits**
- ✅ **Secure Profits**: Lock in gains at major milestones
- ✅ **Risk Management**: Reduce exposure while keeping upside
- ✅ **Moonshot Potential**: 30% remains for 1000x+ gains
- ✅ **Automated**: No manual intervention required

**No more placeholders - everything is production-ready!** 🚀
