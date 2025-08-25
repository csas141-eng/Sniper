# 🎯 **Multi-Tier Profit-Taking Strategy - Complete Guide**

This document explains how your sniper bot now implements a sophisticated multi-tier profit-taking strategy that automatically sells portions of your tokens at specific profit targets while keeping a portion in your wallet.

## 🚀 **Strategy Overview**

Your bot now implements a **3-tier profit-taking system**:

1. **Tier 1**: Sell 35% of tokens when price reaches **100x** from entry
2. **Tier 2**: Sell another 35% of tokens when price reaches **1000x** from entry  
3. **Tier 3**: Keep **30%** of tokens in wallet indefinitely

## ⚙️ **Configuration**

The strategy is configured in `src/config.ts`:

```typescript
PROFIT_TAKING: {
  ENABLED: true,
  MULTI_TIER_STRATEGY: {
    ENABLED: true,
    TIERS: [
      {
        PROFIT_MULTIPLIER: 100,    // 100x from entry price
        SELL_PERCENTAGE: 35,       // Sell 35% of tokens
        DESCRIPTION: "First profit target: 100x"
      },
      {
        PROFIT_MULTIPLIER: 1000,   // 1000x from entry price
        SELL_PERCENTAGE: 35,       // Sell another 35% of tokens
        DESCRIPTION: "Second profit target: 1000x"
      }
    ],
    REMAINING_PERCENTAGE: 30,      // 30% remains in wallet
    MONITORING_INTERVAL: 5000,     // Check price every 5 seconds
    PRICE_CHECK_ENABLED: true      // Enable real-time price monitoring
  }
}
```

## 🔄 **How It Works**

### **Step 1: Token Snipe**
```
🚀 Snipe successful for token ABC123
💰 Entry price: 0.001 SOL
📊 Token amount: 1000 tokens
🎯 Setting up multi-tier profit-taking
📊 Profit targets: 100x (35%) → 1000x (35%) → Keep 30%
✅ Multi-tier profit monitoring started
```

### **Step 2: Continuous Price Monitoring**
```
📈 ABC123: Current price: 0.05 SOL, Profit: 4900.00% (50.00x)
📈 ABC123: Current price: 0.08 SOL, Profit: 7900.00% (80.00x)
📈 ABC123: Current price: 0.10 SOL, Profit: 9900.00% (100.00x)
🎯 TIER 1 TRIGGERED for ABC123!
💰 Selling 350.00 tokens (35%) at First profit target: 100x
📊 Remaining after sell: 650.00 tokens
✅ Tier 1 sell successful: 5J7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
🎯 Tier 1 (100x) completed for ABC123
```

### **Step 3: Second Tier Execution**
```
📈 ABC123: Current price: 0.50 SOL, Profit: 49900.00% (500.00x)
📈 ABC123: Current price: 0.80 SOL, Profit: 79900.00% (800.00x)
📈 ABC123: Current price: 1.00 SOL, Profit: 99900.00% (1000.00x)
🎯 TIER 2 TRIGGERED for ABC123!
💰 Selling 227.50 tokens (35%) at Second profit target: 1000x
📊 Remaining after sell: 422.50 tokens
✅ Tier 2 sell successful: 8yLYtg3CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
🎯 Tier 2 (1000x) completed for ABC123
🏁 All profit targets reached for ABC123. Keeping 422.50 tokens (30%) in wallet.
🛑 Profit monitoring stopped for ABC123
```

## 📊 **Example Scenario**

Let's say you snipe **1000 tokens** at **0.001 SOL** each:

### **Initial State**
- **Entry Price**: 0.001 SOL per token
- **Total Tokens**: 1000
- **Total Value**: 1.0 SOL

### **Tier 1: 100x Profit Target**
- **Trigger Price**: 0.001 × 100 = **0.1 SOL**
- **Sell Amount**: 1000 × 35% = **350 tokens**
- **Sell Value**: 350 × 0.1 = **35 SOL**
- **Remaining**: 1000 - 350 = **650 tokens**

### **Tier 2: 1000x Profit Target**
- **Trigger Price**: 0.001 × 1000 = **1.0 SOL**
- **Sell Amount**: 650 × 35% = **227.5 tokens**
- **Sell Value**: 227.5 × 1.0 = **227.5 SOL**
- **Remaining**: 650 - 227.5 = **422.5 tokens**

### **Final State**
- **Total Sold**: 350 + 227.5 = **577.5 tokens**
- **Total Sold Value**: 35 + 227.5 = **262.5 SOL**
- **Kept in Wallet**: **422.5 tokens** (30%)
- **Potential Future Value**: 422.5 × current_price

## 🎯 **Key Features**

### **1. Real-Time Price Monitoring**
- ✅ **Continuous Monitoring**: Checks token price every 5 seconds
- ✅ **Multi-Platform Support**: Works with Raydium, Pump.fun, LetsBonk
- ✅ **Accurate Price Data**: Uses actual pool data, not estimates

### **2. Smart Selling Logic**
- ✅ **Partial Sells**: Only sells the specified percentage at each tier
- ✅ **Remaining Balance Tracking**: Keeps track of how many tokens are left
- ✅ **Automatic Execution**: No manual intervention required

### **3. Risk Management**
- ✅ **Slippage Protection**: Uses configured slippage for all sells
- ✅ **Transaction Retry**: Automatic retry on failed sells
- ✅ **Error Handling**: Graceful handling of network issues

### **4. Performance Optimization**
- ✅ **Efficient Monitoring**: Only monitors active positions
- ✅ **Automatic Cleanup**: Stops monitoring when targets are reached
- ✅ **Memory Management**: Clears completed monitoring data

## 📈 **Monitoring and Control**

### **Get Current Status**
```typescript
// Get profit monitoring status
const status = bot.getProfitMonitoringStatus();
console.log('Active profit monitoring:', status);

// Get comprehensive bot stats
const stats = bot.getStats();
console.log('Profit monitoring count:', stats.profitMonitoringCount);
```

### **Example Status Output**
```json
{
  "tokenMint": "ABC123...",
  "platform": "raydium",
  "entryPrice": 0.001,
  "remainingAmount": 650.0,
  "soldAmount": 350.0,
  "tier1Sold": true,
  "tier2Sold": false,
  "lastPriceCheck": "2024-01-15T10:30:00.000Z"
}
```

### **Stop Bot (Automatic Cleanup)**
```typescript
// This automatically stops all profit monitoring
bot.stop();
```

## 🔧 **Customization Options**

### **Modify Profit Targets**
```typescript
// In src/config.ts
TIERS: [
  {
    PROFIT_MULTIPLIER: 50,     // Change to 50x
    SELL_PERCENTAGE: 40,       // Change to 40%
    DESCRIPTION: "First profit target: 50x"
  },
  {
    PROFIT_MULTIPLIER: 500,    // Change to 500x
    SELL_PERCENTAGE: 40,       // Change to 40%
    DESCRIPTION: "Second profit target: 500x"
  }
],
REMAINING_PERCENTAGE: 20       // Keep 20% instead of 30%
```

### **Adjust Monitoring Frequency**
```typescript
MONITORING_INTERVAL: 10000,    // Check every 10 seconds instead of 5
```

### **Add More Tiers**
```typescript
TIERS: [
  {
    PROFIT_MULTIPLIER: 100,
    SELL_PERCENTAGE: 25,
    DESCRIPTION: "First profit target: 100x"
  },
  {
    PROFIT_MULTIPLIER: 1000,
    SELL_PERCENTAGE: 25,
    DESCRIPTION: "Second profit target: 1000x"
  },
  {
    PROFIT_MULTIPLIER: 10000,
    SELL_PERCENTAGE: 20,
    DESCRIPTION: "Third profit target: 10000x"
  }
],
REMAINING_PERCENTAGE: 30       // Keep 30%
```

## 🚨 **Important Notes**

### **1. Price Accuracy**
- The bot uses real-time price data from each platform
- Price checks happen every 5 seconds by default
- More frequent checks = more accurate profit detection

### **2. Transaction Timing**
- Sells execute immediately when profit targets are reached
- No delays or manual confirmation required
- Uses configured slippage for all transactions

### **3. Gas Fees**
- Each sell transaction incurs gas fees
- Consider this when setting profit targets
- Higher profit targets = fewer transactions = lower gas costs

### **4. Network Conditions**
- High network congestion may affect sell execution
- The bot includes retry mechanisms for failed transactions
- Monitor transaction status in your wallet

## 🎉 **Benefits of Multi-Tier Strategy**

### **1. Risk Management**
- ✅ **Lock in Profits**: Secure gains at multiple levels
- ✅ **Reduce Exposure**: Don't put all eggs in one basket
- ✅ **Maintain Position**: Keep some tokens for potential moonshots

### **2. Profit Optimization**
- ✅ **Compound Gains**: Reinvest early profits
- ✅ **Scale Positions**: Use profits to snipe more tokens
- ✅ **Long-term Holding**: Keep tokens that continue to perform

### **3. Emotional Control**
- ✅ **Automated Execution**: No FOMO or panic selling
- ✅ **Structured Approach**: Clear profit-taking strategy
- ✅ **Disciplined Trading**: Stick to your plan

## 🏆 **Summary**

**Your sniper bot now implements a sophisticated, automated profit-taking strategy that:**

- 🎯 **Automatically sells 35% at 100x profit**
- 🚀 **Automatically sells another 35% at 1000x profit**  
- 💰 **Keeps 30% in wallet for potential moonshots**
- 📊 **Monitors prices in real-time across all platforms**
- ⚡ **Executes sells instantly when targets are reached**
- 🛡️ **Includes comprehensive error handling and retry logic**

**This gives you the best of both worlds: secure profits and long-term potential! 🎯💰**
