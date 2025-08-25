# Security Documentation for Sniper Bot

## 🚨 IMPORTANT SECURITY WARNINGS

### Phishing and Scam Prevention

**WARNING: This bot handles cryptocurrency transactions and private keys. Always verify you are using the official version.**

#### Common Phishing Attempts to Watch Out For:

1. **Fake GitHub Repositories**
   - ❌ Clones with similar names (e.g., "Sniper-Bot", "SniperV2", etc.)
   - ❌ Repositories asking for your private keys in issues or pull requests
   - ❌ Modified versions that include malicious code
   - ✅ Always verify you're using the official repository

2. **Malicious RPC Endpoints**
   - ❌ Unknown or suspicious RPC URLs
   - ❌ HTTP endpoints (should be HTTPS)
   - ❌ Shortened URLs or redirects
   - ✅ Use only official Solana RPC endpoints (see recommended list below)

3. **Fake Support/Telegram Groups**
   - ❌ Groups asking for private keys or wallet files
   - ❌ "Support" requesting remote access to your computer
   - ❌ DMs offering "premium" versions or asking for payment
   - ✅ Never share private keys with anyone

#### Recommended Official RPC Endpoints:

```
Primary (Official):
- https://api.mainnet-beta.solana.com

Trusted Partners:
- https://solana-api.projectserum.com
- https://rpc.ankr.com/solana  
- https://ssc-dao.genesysgo.net
```

### Wallet Security Best Practices

#### 1. Use Dedicated Trading Wallets
- ✅ Create a separate wallet specifically for trading
- ✅ Only keep funds needed for trading in this wallet
- ✅ Store main funds in a secure, offline wallet

#### 2. Encrypted Wallet Storage
- ✅ Use the bot's encrypted wallet feature
- ✅ Use a strong, unique password
- ✅ Never store passwords in plain text
- ❌ Don't use config.json for private keys

#### 3. Regular Security Checks
- ✅ Run `npm run audit` regularly
- ✅ Keep dependencies updated
- ✅ Monitor for suspicious activity
- ✅ Review blacklist updates

### Configuration Security

#### Secure Configuration Practices:
```json
{
  "solanaRpcUrl": "https://api.mainnet-beta.solana.com",
  "buyAmountSol": 0.01,
  "security": {
    "validateTransactions": true,
    "checkTokenContract": true,
    "maxTransactionRetries": 2
  }
}
```

#### ❌ NEVER DO THIS:
```json
{
  "privateKey": [123, 456, 789, ...],  // DON'T store keys in config
  "solanaRpcUrl": "http://suspicious-rpc.com",  // DON'T use unknown RPCs
}
```

## 🛡️ Built-in Security Features

### 1. Address Blacklist System
- Blocks known drainer addresses
- Real-time validation during transactions
- Community-updatable blacklist
- Automatic notifications for blacklist hits

### 2. Transaction Anomaly Detection  
- Pattern analysis for suspicious transactions
- Risk scoring system
- Automatic circuit breaker activation
- User confirmation for high-risk patterns

### 3. Balance Validation
- Issuer balance checking before trades
- Zero-balance protection
- Suspicious pattern detection
- Risk level assessment

### 4. User Confirmation System
- Manual approval for risky actions
- Risk level-based thresholds
- Timeout protection
- Detailed risk explanations

### 5. RPC Endpoint Validation
- Official endpoint verification
- Security scoring system
- Malicious endpoint detection
- Recommendations for safer alternatives

## 🔧 Security Configuration

### Enable All Security Features:
```json
{
  "security": {
    "validateTransactions": true,
    "checkTokenContract": true,
    "maxTransactionRetries": 2,
    "enableBlacklist": true,
    "enableAnomalyDetection": true,
    "enableUserConfirmation": true,
    "enableBalanceValidation": true
  },
  "circuitBreaker": {
    "enabled": true,
    "dailyLossThreshold": 1.0,
    "singleLossThreshold": 0.5,
    "errorThreshold": 10
  }
}
```

### Risk Management Settings:
```json
{
  "riskManagement": {
    "maxSlippage": 0.15,
    "maxGasPrice": 100000,
    "stopLoss": 0.1,
    "takeProfit": 0.2
  }
}
```

## 🚀 Getting Started Securely

### 1. Verify Official Source
```bash
# Verify you have the official repository
git remote -v
# Should show: https://github.com/csas141-eng/Sniper
```

### 2. Run Security Audit
```bash
# Check dependencies for vulnerabilities
npm run audit

# Fix any critical issues
npm audit fix
```

### 3. Create Encrypted Wallet
```bash
# Generate new encrypted wallet
node generate-wallet.js --encrypted

# Or convert existing wallet
node -e "const {WalletSecurity} = require('./dist/services/wallet-security'); WalletSecurity.convertPlainWallet('./my-wallet.json', './my-wallet.encrypted.json')"
```

### 4. Configure Security Settings
- Use recommended configuration above
- Enable all security features
- Set appropriate risk thresholds
- Use official RPC endpoints only

## 📞 Reporting Security Issues

If you discover security vulnerabilities:

1. **DO NOT** open public issues
2. Contact maintainers privately
3. Provide detailed reproduction steps
4. Allow time for responsible disclosure

## 🔄 Regular Maintenance

### Weekly Tasks:
- [ ] Run security audit: `npm run audit`
- [ ] Update blacklist: Check for community updates
- [ ] Review transaction logs for anomalies
- [ ] Verify RPC endpoint still secure

### Monthly Tasks:
- [ ] Update dependencies: `npm update`
- [ ] Review and rotate wallet if needed
- [ ] Backup encrypted wallet file
- [ ] Review security configuration

## 🚨 Emergency Procedures

### If You Suspect Compromise:
1. **STOP** the bot immediately
2. Transfer funds to a new, secure wallet
3. Generate new trading wallet
4. Review recent transactions
5. Update all passwords and keys

### If You See Suspicious Activity:
1. Enable circuit breaker manually
2. Review transaction logs
3. Check blacklist for new entries
4. Report to community if confirmed threat

---

**Remember: Security is your responsibility. This bot provides tools, but you must use them correctly and stay vigilant.**