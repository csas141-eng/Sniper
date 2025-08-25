# 🛡️ Solana Sniper Bot - Secure Enhanced Version

## ⚠️ CRITICAL SECURITY WARNING

**Before using this bot, read the [SECURITY.md](./SECURITY.md) file carefully to protect yourself from phishing attacks and drainer contracts.**

🚨 **NEVER share your private keys or wallet files with anyone!**
🚨 **Only use official RPC endpoints!**
🚨 **Use dedicated trading wallets with limited funds!**

A high-performance, security-first Solana sniper bot with comprehensive anti-drainer protections, designed to automatically detect and snipe new tokens from designated developer addresses across multiple platforms.

## 🔐 Security Features (NEW!)

### 🛡️ **Comprehensive Anti-Drainer Protection**
- **Address Blacklist System**: Real-time protection against known drainer addresses
- **Transaction Anomaly Detection**: AI-powered pattern analysis to detect suspicious transactions
- **Balance Validation**: Checks issuer balance before trades (blocks zero-balance scams)
- **User Confirmation System**: Manual approval required for high-risk actions
- **Circuit Breaker**: Automatic trading halt on suspicious activity or excessive losses

### 🔐 **Wallet Security**
- **Encrypted Wallet Storage**: Password-protected private key encryption
- **Secure Password Prompts**: Hidden password input for maximum security
- **High-Value Wallet Warnings**: Alerts when using wallets with significant funds
- **Dedicated Trading Wallet Support**: Encourages use of limited-fund wallets

### 🌐 **RPC Endpoint Validation**  
- **Official Endpoint Verification**: Validates RPC endpoints against official Solana sources
- **Malicious Endpoint Detection**: Blocks known malicious or suspicious RPC providers
- **Security Scoring**: Rates RPC endpoints based on trust and security factors
- **Phishing Prevention**: Warns against fake or redirected endpoints

### 📋 **Dependency Security**
- **Automated Security Audits**: Built-in dependency vulnerability scanning
- **Version Locking**: Package-lock.json enforcement for reproducible builds
- **Regular Update Checks**: Automated checks for outdated packages
- **Vulnerability Reporting**: Detailed security reports with fix recommendations

### 🚨 **Monitoring & Alerts**
- **Real-time Notifications**: Instant alerts for security events
- **Circuit Breaker Notifications**: User alerts when trading is halted
- **Blacklist Hit Reporting**: Notifications when blocked addresses are encountered
- **Anomaly Detection Alerts**: Warnings for suspicious transaction patterns

## 🚀 Platform Support

### **Multi-Platform Token Detection**
- **Pump.fun Integration**: Real-time monitoring via WebSocket connections
- **Raydium Integration**: Pool creation detection and automated sniping  
- **LetsBonk SDK**: Enhanced with security validations
- **Meteora Support**: Additional DEX platform coverage

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
