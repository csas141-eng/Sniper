# Multisig Wallet Setup Guide

## Overview
Setting up a multisig (multisignature) wallet provides an additional layer of security for your funds by requiring multiple signatures before any transaction can be executed.

## Prerequisites
- Solana CLI tools installed
- Multiple keypairs/wallets ready
- Understanding of multisig concepts

## Step 1: Create Multisig Account

### Generate Required Keypairs
```bash
# Generate keypairs for multisig participants
solana-keygen new --outfile ./multisig-key1.json
solana-keygen new --outfile ./multisig-key2.json
solana-keygen new --outfile ./multisig-key3.json
```

### Create Multisig Account
```bash
# Create a 2-of-3 multisig account
solana multisig-create \
  --keypair ./multisig-key1.json \
  --minimum-signers 2 \
  ./multisig-key1.json \
  ./multisig-key2.json \
  ./multisig-key3.json
```

## Step 2: Configure Sniper Bot for Multisig

### Update config.json
```json
{
  "multisig": {
    "enabled": true,
    "multisigAccount": "YOUR_MULTISIG_ACCOUNT_ADDRESS",
    "requiredSigners": 2,
    "signerKeypaths": [
      "./multisig-key1.json",
      "./multisig-key2.json",
      "./multisig-key3.json"
    ],
    "confirmationRequired": true
  },
  "security": {
    "requireMultisigForLargeTrades": true,
    "largeTradeThreshold": 1.0
  }
}
```

## Step 3: Multisig Transaction Flow

### For Large Trades (> threshold)
1. Bot creates transaction
2. First signer signs automatically
3. Bot pauses and requests additional signatures
4. Other signers approve via CLI or interface
5. Transaction executes when threshold reached

### Manual Multisig Commands

#### Create Transaction
```bash
# Create a multisig transaction
solana multisig-transaction create \
  --multisig-account MULTISIG_ACCOUNT \
  --keypair ./signer-key.json \
  --instruction "transfer --to RECIPIENT --amount 1.5"
```

#### Sign Transaction
```bash
# Sign an existing transaction
solana multisig-transaction sign \
  --multisig-account MULTISIG_ACCOUNT \
  --transaction-account TRANSACTION_ACCOUNT \
  --keypair ./signer-key.json
```

#### Execute Transaction
```bash
# Execute when enough signatures collected
solana multisig-transaction execute \
  --multisig-account MULTISIG_ACCOUNT \
  --transaction-account TRANSACTION_ACCOUNT
```

## Step 4: Bot Integration Code

### Multisig Service Implementation
```typescript
// src/services/multisig-service.ts
export class MultisigService {
  async requiresMultisig(amount: number): Promise<boolean> {
    return amount > config.security.largeTradeThreshold;
  }
  
  async createMultisigTransaction(instruction: TransactionInstruction): Promise<string> {
    // Implementation for creating multisig transaction
  }
  
  async signTransaction(transactionAccount: string): Promise<void> {
    // Implementation for signing
  }
  
  async executeWhenReady(transactionAccount: string): Promise<string> {
    // Implementation for execution
  }
}
```

### Usage in Sniper Bot
```typescript
// In snipeToken method
if (await this.multisigService.requiresMultisig(this.buyAmountSol)) {
  console.log('🔐 Large trade - multisig required');
  
  const txAccount = await this.multisigService.createMultisigTransaction(instruction);
  
  // First signature from bot
  await this.multisigService.signTransaction(txAccount);
  
  // Wait for additional signatures
  await this.multisigService.waitForAdditionalSignatures(txAccount);
  
  // Execute when ready
  const signature = await this.multisigService.executeWhenReady(txAccount);
  return signature;
}
```

## Step 5: Security Best Practices

### Signer Distribution
- Store signers on different devices/locations
- Use hardware wallets for critical signers
- Implement time-based locks for sensitive operations

### Access Control
```json
{
  "multisig": {
    "signers": [
      {
        "publicKey": "SIGNER1_PUBKEY",
        "role": "primary",
        "device": "hardware_wallet_1"
      },
      {
        "publicKey": "SIGNER2_PUBKEY", 
        "role": "secondary",
        "device": "secure_server"
      },
      {
        "publicKey": "SIGNER3_PUBKEY",
        "role": "emergency", 
        "device": "offline_backup"
      }
    ]
  }
}
```

### Emergency Procedures
1. **Compromised Signer**: Remove from multisig, create new multisig
2. **Lost Signer**: Use remaining signers to create new multisig
3. **Bot Compromise**: Emergency stop all operations, manual review

## Step 6: Monitoring and Alerts

### Transaction Monitoring
```typescript
// Monitor multisig transactions
setInterval(async () => {
  const pending = await this.multisigService.getPendingTransactions();
  
  if (pending.length > 0) {
    await notificationService.sendAlert(
      'MULTISIG_PENDING',
      `${pending.length} multisig transactions awaiting signatures`
    );
  }
}, 60000); // Check every minute
```

### Notification Setup
- Email alerts for pending transactions
- Telegram/Discord notifications
- SMS for critical operations

## Step 7: Testing

### Test Multisig Setup
```bash
# Test with small amounts first
solana multisig-create --test
solana transfer --test --amount 0.001
```

### Validation Checklist
- [ ] Multisig account created successfully
- [ ] Required number of signers configured
- [ ] Bot can create transactions
- [ ] Additional signers can sign
- [ ] Transactions execute correctly
- [ ] Emergency procedures work
- [ ] Monitoring alerts function

## Troubleshooting

### Common Issues
1. **Insufficient Signers**: Ensure enough signers are available
2. **Network Issues**: Use reliable RPC endpoints
3. **Key Management**: Secure storage and backup of keys
4. **Timing**: Allow sufficient time for signature collection

### Recovery Options
- Emergency signer activation
- Manual transaction creation
- Multisig account recreation

---

**Security Note**: Multisig adds security but also complexity. Test thoroughly with small amounts before using for large trades.