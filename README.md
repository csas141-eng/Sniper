# Solana Sniper Bot - Enhanced Version

A high-performance Solana sniper bot designed to automatically detect and snipe new tokens from designated developer addresses across multiple platforms including Pump.fun, Raydium, and LetsBonk.

## 🚀 Key Improvements Made

### 1. **Multi-Platform Support**
- **Pump.fun Integration**: Real-time monitoring of Pump.fun token creation
- **Raydium Integration**: Pool creation detection and automated sniping
- **LetsBonk SDK**: Enhanced with priority fees and proper transaction handling
- **WebSocket Support**: Pump Portal integration for fastest token detection

### 2. **Enhanced Performance**
- **Priority Fees**: Automatic priority fee calculation for faster transaction processing
- **Compute Unit Optimization**: Optimized compute unit limits for better success rates
- **Concurrent Sniping**: Support for multiple simultaneous snipes (configurable)
- **Retry Logic**: Intelligent retry mechanism with exponential backoff

### 3. **Better Error Handling**
- **Transaction Validation**: Comprehensive transaction verification
- **Liquidity Checks**: Pre-snipe liquidity validation
- **Balance Monitoring**: Automatic balance checks and warnings
- **Failed Transaction Tracking**: Detailed logging of failed transactions

### 4. **Configuration Improvements**
- **Helius RPC**: Using premium RPC for better performance
- **Optimized Slippage**: Increased default slippage for better success rates
- **Flexible Amounts**: Configurable buy amounts and retry settings

## 📋 Prerequisites

- Node.js 18+ 
- Solana CLI tools
- A Solana wallet with SOL balance
- API keys for premium RPC services (optional but recommended)

## 🛠️ Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd sbsniper

# Install dependencies
npm install

# Build the project
npm run build
```

## ⚙️ Configuration

### Main Configuration (`src/config.ts`)
```typescript
export const CONFIG = {
  SOLANA_RPC_URL: 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY',
  walletPath: 'path/to/your/wallet.json',
  TARGET_DEVELOPERS: [
    'BAGSB9TpGrZxQbEsrEznv5jXXdwyP6AXerN8aVRiAmcv',
    // ... more developer addresses
  ],
  AMOUNT_TO_BUY: 0.0002, // SOL amount per snipe
  SLIPPAGE: 0.3, // 30% slippage tolerance
  MAX_RETRIES: 5,
  RETRY_DELAY: 1000, // ms
  MIN_LIQUIDITY: 0.001, // minimum SOL liquidity required
  PRIORITY_FEE: 50000, // micro-lamports
  MAX_CONCURRENT_SNIPES: 3
};
```

### Wallet Setup
1. Create a Solana wallet or use existing one
2. Ensure sufficient SOL balance (recommended: 0.1+ SOL)
3. Update the `walletPath` in config

## 🚀 Usage

### Start the Bot
```bash
npm start
```

### Monitor Output
The bot will automatically:
- Connect to multiple platforms
- Monitor developer addresses
- Detect new token creations
- Execute snipes with optimized parameters
- Provide detailed logging and statistics

## 🔧 Platform-Specific Features

### Pump.fun
- Real-time token creation monitoring
- Automatic pool detection
- Optimized swap instructions

### Raydium
- Pool creation monitoring
- AMM integration
- Liquidity validation

### LetsBonk
- Enhanced SDK with priority fees
- Token balance tracking
- Price estimation

## 📊 Monitoring & Statistics

### Real-time Stats
```typescript
// Get current statistics
const stats = bot.getStats();
console.log(`Total Snipes: ${stats.totalSnipes}`);
console.log(`Successful: ${stats.successfulSnipes}`);
console.log(`Failed: ${stats.failedSnipes}`);
```

### Snipe History
```typescript
// Get detailed snipe history
const history = bot.getSnipeHistory();
history.forEach(snipe => {
  console.log(`${snipe.platform}: ${snipe.tokenMint} - ${snipe.success ? 'SUCCESS' : 'FAILED'}`);
});
```

## ⚠️ Important Notes

### Slippage Settings
- **Default**: 30% (0.3) - Higher success rate but potential for higher prices
- **Conservative**: 10-15% for better price control
- **Aggressive**: 50%+ for maximum success rate

### Gas Optimization
- **Priority Fees**: Automatically set to 50,000 micro-lamports
- **Compute Units**: Optimized to 400,000 units
- **Transaction Batching**: Automatic instruction optimization

### Risk Management
- **Liquidity Checks**: Minimum 0.001 SOL liquidity required
- **Balance Monitoring**: Automatic 0.05 SOL minimum balance check
- **Concurrent Limits**: Maximum 3 simultaneous snipes (configurable)

## 🐛 Troubleshooting

### Common Issues

1. **Insufficient Balance**
   - Ensure wallet has at least 0.1 SOL
   - Check for pending transactions

2. **Transaction Failures**
   - Verify RPC endpoint connectivity
   - Check slippage settings
   - Ensure sufficient liquidity

3. **WebSocket Disconnections**
   - Automatic reconnection implemented
   - Check network stability

### Debug Mode
Enable detailed logging by setting environment variables:
```bash
DEBUG=* npm start
```

## 🔒 Security Considerations

- **Private Keys**: Never share wallet private keys
- **RPC Endpoints**: Use secure, private RPC endpoints
- **Network Security**: Run on secure, private networks
- **API Keys**: Keep API keys confidential

## 📈 Performance Tips

1. **Use Premium RPC**: Helius, QuickNode, or Alchemy
2. **Optimize Slippage**: Balance between success rate and price
3. **Monitor Gas**: Adjust priority fees based on network conditions
4. **Regular Updates**: Keep dependencies updated

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This bot is for educational and research purposes. Trading cryptocurrencies involves significant risk. Use at your own risk and never invest more than you can afford to lose.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs for error details
3. Open an issue on GitHub
4. Join our community discussions

---

**Happy Sniping! 🚀**
