# Remote Blacklist Update System

## Overview
This system allows for automatic updates to the address blacklist from trusted remote sources, enabling community-driven protection against new drainer addresses.

## Architecture

```
Community Sources → GitHub/IPFS → Validation → Local Blacklist → Bot Protection
```

## Step 1: Setup Remote Update Service

### Create Update Service
```typescript
// src/services/remote-blacklist-updater.ts
export class RemoteBlacklistUpdater {
  private sources: RemoteSource[] = [
    {
      name: 'community-github',
      url: 'https://raw.githubusercontent.com/solana-security/blacklist/main/addresses.json',
      trustLevel: 'high',
      publicKey: 'GITHUB_SIGNING_KEY'
    },
    {
      name: 'drainer-watch',
      url: 'https://api.drainerwatch.com/v1/blacklist',
      trustLevel: 'medium',
      apiKey: process.env.DRAINER_WATCH_API_KEY
    }
  ];
  
  async updateFromSources(): Promise<UpdateResult> {
    // Implementation
  }
}
```

### Configuration
```json
{
  "remoteBlacklist": {
    "enabled": true,
    "updateInterval": 3600000,
    "sources": [
      {
        "name": "community-github",
        "url": "https://raw.githubusercontent.com/solana-security/blacklist/main/addresses.json",
        "enabled": true,
        "trustLevel": "high",
        "requiresSignature": true
      },
      {
        "name": "local-community",
        "url": "https://your-community-source.com/blacklist.json",
        "enabled": false,
        "trustLevel": "medium",
        "apiKey": "optional-api-key"
      }
    ],
    "validation": {
      "requireSignatures": true,
      "minimumTrustLevel": "medium",
      "maxEntriesPerUpdate": 1000
    }
  }
}
```

## Step 2: Community GitHub Repository Structure

### Repository Layout
```
solana-security/blacklist/
├── addresses.json          # Main blacklist
├── signatures/            # Cryptographic signatures
│   ├── addresses.json.sig
│   └── public-keys.json
├── sources/              # Individual source files
│   ├── drainer-reports.json
│   ├── community-reports.json
│   └── automated-detection.json
└── README.md            # Documentation
```

### Blacklist Format
```json
{
  "version": "1.2.0",
  "lastUpdated": "2024-01-15T10:30:00Z",
  "signature": "base64-signature-here",
  "entries": [
    {
      "address": "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
      "reason": "Confirmed drainer wallet - multiple victims",
      "severity": "critical",
      "dateAdded": "2024-01-15T08:00:00Z",
      "source": "community-report",
      "reportedBy": "security-team",
      "evidence": "https://solscan.io/account/...",
      "victimCount": 15,
      "totalLoss": 45.2
    }
  ],
  "metadata": {
    "totalEntries": 1,
    "sources": ["community-report", "automated-detection"],
    "contributors": ["security-team", "community-volunteers"]
  }
}
```

## Step 3: Update Service Implementation

### Remote Update Script
```typescript
import { RemoteBlacklistUpdater } from './services/remote-blacklist-updater';
import { addressBlacklist } from './services/address-blacklist';

export class RemoteBlacklistUpdater {
  async updateFromSources(): Promise<void> {
    console.log('🔄 Starting remote blacklist update...');
    
    for (const source of this.sources) {
      if (!source.enabled) continue;
      
      try {
        console.log(`📥 Fetching from ${source.name}...`);
        const data = await this.fetchFromSource(source);
        
        if (await this.validateData(data, source)) {
          const newEntries = await this.processUpdate(data);
          console.log(`✅ Added ${newEntries} new entries from ${source.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to update from ${source.name}:`, error.message);
      }
    }
  }
  
  private async validateData(data: any, source: RemoteSource): Promise<boolean> {
    // Signature verification
    if (source.requiresSignature && !this.verifySignature(data, source)) {
      throw new Error('Invalid signature');
    }
    
    // Size validation
    if (data.entries.length > 1000) {
      throw new Error('Too many entries in single update');
    }
    
    // Content validation
    for (const entry of data.entries) {
      if (!this.isValidEntry(entry)) {
        throw new Error('Invalid entry format');
      }
    }
    
    return true;
  }
}
```

## Step 4: Automated Update Script

### Cron Job Setup
```bash
# Add to crontab for hourly updates
0 * * * * cd /path/to/sniper && node scripts/update-blacklist.js

# Or for more frequent updates (every 15 minutes)
*/15 * * * * cd /path/to/sniper && node scripts/update-blacklist.js --quick
```

### Update Script
```javascript
#!/usr/bin/env node
// scripts/update-blacklist.js

const { RemoteBlacklistUpdater } = require('../dist/services/remote-blacklist-updater');
const { logger } = require('../dist/services/structured-logger');

async function main() {
  const args = process.argv.slice(2);
  const isQuickUpdate = args.includes('--quick');
  
  console.log(`🔄 Starting ${isQuickUpdate ? 'quick' : 'full'} blacklist update...`);
  
  try {
    const updater = new RemoteBlacklistUpdater();
    const result = await updater.updateFromSources({ quick: isQuickUpdate });
    
    console.log(`✅ Update complete: ${result.newEntries} new entries added`);
    
    if (result.newEntries > 0) {
      // Send notification about updates
      const { notificationService } = require('../dist/services/notifications');
      await notificationService.sendNotification(
        'BLACKLIST_UPDATED',
        `Blacklist updated with ${result.newEntries} new entries`,
        result
      );
    }
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    logger.error('Blacklist update failed', { error: error.message });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
```

## Step 5: Community Contribution System

### Report New Addresses
```javascript
// scripts/report-address.js
#!/usr/bin/env node

const readline = require('readline');
const { addressBlacklist } = require('../dist/services/address-blacklist');

async function reportAddress() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('🚨 Report Suspicious Address');
  console.log('================================\n');
  
  const address = await askQuestion('Address to report: ');
  const reason = await askQuestion('Reason (brief): ');
  const evidence = await askQuestion('Evidence (URL, transaction, etc.): ');
  const severity = await askQuestion('Severity (low/medium/high/critical): ');
  
  try {
    // Add to local blacklist
    addressBlacklist.addToBlacklist(address, reason, 'manual', severity, evidence);
    
    // Generate report for community submission
    const report = {
      address,
      reason,
      severity,
      evidence,
      reportedBy: 'community-user',
      timestamp: new Date().toISOString()
    };
    
    console.log('\n📝 Report generated:');
    console.log(JSON.stringify(report, null, 2));
    
    console.log('\n💡 To submit to community blacklist:');
    console.log('1. Copy the report above');
    console.log('2. Create issue at: https://github.com/solana-security/blacklist/issues');
    console.log('3. Use template: "New Address Report"');
    
    rl.close();
  } catch (error) {
    console.error('❌ Error reporting address:', error.message);
    rl.close();
  }
}

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

reportAddress();
```

## Step 6: Signature Verification

### Generate Signing Keys
```bash
# Generate keys for signing blacklist updates
openssl genpkey -algorithm Ed25519 -out private-key.pem
openssl pkey -in private-key.pem -pubout -out public-key.pem
```

### Signing Process
```javascript
// scripts/sign-blacklist.js
const crypto = require('crypto');
const fs = require('fs');

function signBlacklist(blacklistPath, privateKeyPath) {
  const blacklistData = fs.readFileSync(blacklistPath);
  const privateKey = fs.readFileSync(privateKeyPath);
  
  const signature = crypto.sign(null, blacklistData, {
    key: privateKey,
    format: 'pem'
  });
  
  return signature.toString('base64');
}
```

## Step 7: Integration with Bot

### Bot Integration
```typescript
// In main bot initialization
import { RemoteBlacklistUpdater } from './services/remote-blacklist-updater';

class SniperBot {
  private remoteUpdater: RemoteBlacklistUpdater;
  
  constructor() {
    this.remoteUpdater = new RemoteBlacklistUpdater();
    
    // Start automatic updates
    setInterval(() => {
      this.remoteUpdater.updateFromSources();
    }, 60 * 60 * 1000); // Every hour
  }
}
```

## Step 8: Monitoring and Alerts

### Update Monitoring
```typescript
// Monitor update success/failures
export class BlacklistMonitor {
  private updateHistory: UpdateRecord[] = [];
  
  async checkUpdateHealth(): Promise<HealthStatus> {
    const recent = this.updateHistory.filter(
      record => Date.now() - record.timestamp < 24 * 60 * 60 * 1000
    );
    
    const failedUpdates = recent.filter(record => !record.success);
    
    if (failedUpdates.length > 5) {
      await notificationService.sendAlert(
        'BLACKLIST_UPDATE_FAILURES',
        'Multiple blacklist update failures detected'
      );
    }
    
    return {
      healthy: failedUpdates.length < 3,
      recentUpdates: recent.length,
      failures: failedUpdates.length
    };
  }
}
```

## Security Considerations

### Trust Model
- **High Trust**: Cryptographically signed sources
- **Medium Trust**: API-based sources with authentication
- **Low Trust**: Community submissions (manual review)

### Validation Pipeline
1. Source authentication
2. Signature verification
3. Content validation
4. Rate limiting
5. Manual review for suspicious entries

### Emergency Procedures
- Manual blacklist override
- Source disabling
- Rollback capabilities
- Community alert system

---

**Important**: Always verify blacklist sources and maintain local control over your security decisions.