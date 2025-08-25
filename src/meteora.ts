import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { SniperBot } from './sniper-bot';
// import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';

export interface MeteoraTokenInfo {
  mint: PublicKey;
  developer: PublicKey;
  poolAddress: PublicKey;
  initialLiquidity: number;
  timestamp: number;
  name?: string;
  symbol?: string;
  baseReserve?: number;
  quoteReserve?: number;
  holders?: number;
  // add more fields if referenced
}

export class MeteoraMonitor {
  private connection: Connection;
  private sniperBot: SniperBot;
  private meteoraProgramId: PublicKey;
  // private meteoraClient: DynamicBondingCurveClient;
  private isMonitoring: boolean = false;
  private onNewTokenCallback?: (tokenInfo: MeteoraTokenInfo) => Promise<void>;
  private lastProcessedSignature: string | null = null;

  constructor(connection: Connection, sniperBot: SniperBot) {
    this.connection = connection;
    this.sniperBot = sniperBot;
    // Meteora Dynamic Bonding Curve Program ID
    this.meteoraProgramId = new PublicKey('dbcij3LWUppWqq96dh6gJGwBifmcGfLSB5D4DuSMaqN');
    // Initialize Meteora SDK client
    // this.meteoraClient = DynamicBondingCurveClient.create(connection, 'confirmed');
  }

  // Add callback method for new token notifications
  async onNewToken(callback: (tokenInfo: MeteoraTokenInfo) => Promise<void>): Promise<void> {
    this.onNewTokenCallback = callback;
    console.log('✅ Meteora new token callback registered');
  }

  // Add getTokenPrice method for liquidity checking
  async getTokenPrice(tokenMint: PublicKey): Promise<number> {
    try {
      // Use the Meteora SDK to get pool information and calculate price
      const pool = await this.getPoolByBaseMint(tokenMint);
      if (!pool) {
        return 0; // Pool not found
      }

      // Calculate price based on current reserves
      const baseReserve = pool.account.baseReserve;
      const quoteReserve = pool.account.quoteReserve;
      
      if (baseReserve.isZero() || quoteReserve.isZero()) {
        return 0;
      }

      // Price = quoteReserve / baseReserve (SOL per token)
      const price = quoteReserve.toNumber() / baseReserve.toNumber();
      return price;
    } catch (error) {
      console.error('Error getting Meteora token price:', error);
      return 0;
    }
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;
    
    console.log('🚀 Starting Meteora Dynamic Bonding Curve monitoring...');
    this.isMonitoring = true;

    // Start monitoring for new pools
    this.startPoolMonitoring();
    
    // Also monitor program logs for real-time events
    this.startLogMonitoring();

    console.log('✅ Meteora monitoring started');
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;
    
    console.log('🛑 Stopping Meteora monitoring...');
    this.isMonitoring = false;
    
    console.log('✅ Meteora monitoring stopped');
  }

  private startPoolMonitoring(): void {
    // Poll for new pools every 10 seconds
    setInterval(async () => {
      if (!this.isMonitoring) return;
      await this.checkForNewPools();
    }, 10000);
  }

  private startLogMonitoring(): void {
    // Monitor Meteora program logs for new token launches
    this.connection.onLogs(
      this.meteoraProgramId,
      (logs, context) => {
        this.handleMeteoraLogs(logs, context);
      },
      'confirmed'
    );
  }

  private async checkForNewPools(): Promise<void> {
    try {
      // Get all pools and check for new ones
      const allPools = await this.getAllPools();
      
      for (const pool of allPools) {
        if (this.isNewPool(pool)) {
          await this.processNewPool(pool);
        }
      }
    } catch (error) {
      console.error('Error checking for new pools:', error);
    }
  }

  private async getAllPools(): Promise<any[]> {
    try {
      // Placeholder: Get pools from on-chain data
      console.log(`🎯 Meteora: Placeholder - pool detection`);
      return [];
    } catch (error) {
      console.error('Error getting pools from Meteora SDK:', error);
      return [];
    }
  }

  private isNewPool(pool: any): boolean {
    try {
      // Check if this pool was created recently (within last 5 minutes)
      const poolAge = Date.now() - pool.account.createdAt.toNumber() * 1000;
      return poolAge < 5 * 60 * 1000; // 5 minutes
    } catch (error) {
      console.error('Error checking pool age:', error);
      return false;
    }
  }

  private async processNewPool(pool: any): Promise<void> {
    try {
      console.log(`🎯 New Meteora pool detected: ${pool.pubkey.toBase58()}`);
      
      const tokenInfo: MeteoraTokenInfo = {
        mint: pool.account.baseMint,
        developer: pool.account.creator,
        poolAddress: pool.pubkey,
        initialLiquidity: pool.account.quoteReserve.toNumber() / 1e9, // Convert from lamports to SOL
        timestamp: Date.now(),
        name: pool.account.name,
        symbol: pool.account.symbol
      };

      // Basic token detection with age check
      const tokenAge = Date.now() - tokenInfo.timestamp;
      const maxAgeMs = 10 * 60 * 1000; // 10 minutes in milliseconds
      
      if (tokenAge > maxAgeMs) {
        console.log(`⏰ Meteora token ${tokenInfo.mint.toBase58()} is ${Math.round(tokenAge / 60000)} minutes old - too old to snipe`);
        return;
      }
      
      console.log('🎯 Meteora token detected (basic data):', {
        mint: tokenInfo.mint.toBase58(),
        developer: tokenInfo.developer.toBase58(),
        poolAddress: tokenInfo.poolAddress.toBase58(),
        initialLiquidity: tokenInfo.initialLiquidity,
        timestamp: tokenInfo.timestamp,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol
      });
      console.log(`⏰ Token age: ${Math.round(tokenAge / 60000)} minutes (within 10-minute limit)`);

      // Notify through callback if registered
      if (this.onNewTokenCallback) {
        await this.onNewTokenCallback(tokenInfo);
      }
    } catch (error) {
      console.error('Error processing new pool:', error);
    }
  }

  private async handleMeteoraLogs(logs: any, context: any): Promise<void> {
    try {
      // Skip if we've already processed this signature
      if (this.lastProcessedSignature === context.signature) {
        return;
      }

      console.log('🔍 Meteora logs received:', {
        signature: context.signature,
        logs: logs.logs
      });

      // Look for token creation patterns in Meteora logs
      const tokenInfo = await this.extractTokenInfoFromLogs(logs.logs, context.signature);
      
      if (tokenInfo) {
        console.log('🎯 Meteora token detected from logs:', {
          mint: tokenInfo.mint.toBase58(),
          developer: tokenInfo.developer.toBase58(),
          poolAddress: tokenInfo.poolAddress.toBase58(),
          initialLiquidity: tokenInfo.initialLiquidity,
          timestamp: tokenInfo.timestamp
        });

        // Notify through callback if registered
        if (this.onNewTokenCallback) {
          await this.onNewTokenCallback(tokenInfo);
        }
      }

      this.lastProcessedSignature = context.signature;
    } catch (error) {
      console.error('Error handling Meteora logs:', error);
    }
  }

  // ✅ ENHANCED: Advanced log parsing for Meteora tokens with multiple patterns
  private async extractTokenInfoFromLogs(logs: string[], signature: string): Promise<MeteoraTokenInfo | null> {
    try {
      // Add more patterns for pool and token creation
      const creationPatterns = [
        /Initialize.*pool/i,
        /Create.*token/i,
        /New.*bonding.*curve/i,
        /Pool.*created/i,
        /Virtual.*pool.*initialized/i,
        /Dynamic.*bonding.*curve/i,
        /Token.*launched/i,
        /Pool.*initialized/i,
        /Bonding.*curve.*created/i,
        /Virtual.*pool.*created/i
      ];

      const hasCreationPattern = creationPatterns.some(pattern => 
        logs.some(log => pattern.test(log))
      );

      if (!hasCreationPattern) {
        return null;
      }

      // Enhanced extraction logic with multiple fallback patterns
      const mintMatch = logs.join(' ').match(/(?:mint|token|baseMint|base_mint|address):\s*([A-Za-z0-9]{32,44})/i) ||
                       logs.join(' ').match(/mint=([A-Za-z0-9]{32,44})/i) ||
                       logs.join(' ').match(/token=([A-Za-z0-9]{32,44})/i) ||
                       logs.join(' ').match(/([A-Za-z0-9]{32,44})/g);
      
      if (!mintMatch || mintMatch.length === 0) {
        return null;
      }

      // Use the first valid mint address found
      const mintAddress = Array.isArray(mintMatch) ? mintMatch[0] : mintMatch[1];
      let mint: PublicKey;
      
      try {
        mint = new PublicKey(mintAddress);
      } catch {
        return null;
      }

      // Try to extract developer from transaction context
      const developer = await this.extractDeveloperFromTransaction(signature);
      
      if (!developer) {
        console.log('⚠️ Could not extract developer from Meteora transaction');
        return null;
      }

      // Create pool address (this might need adjustment based on Meteora's structure)
      const poolAddress = new PublicKey(mintAddress); // Placeholder - adjust as needed

      // Extract additional pool data if available
      const poolData = this.extractMeteoraPoolDataFromLogs(logs);

      return {
        mint,
        developer,
        poolAddress,
        initialLiquidity: poolData.initialLiquidity || 0,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error extracting token info from Meteora logs:', error);
      return null;
    }
  }

  // ✅ NEW: Enhanced pool data extraction from Meteora logs
  private extractMeteoraPoolDataFromLogs(logs: string[]): any {
    const poolData: any = {};
    
    for (const log of logs) {
      // Extract liquidity information
      const liquidityMatch = log.match(/(?:liquidity|baseReserve|quoteReserve|virtualReserve):\s*([0-9.]+)/i);
      if (liquidityMatch) {
        poolData.initialLiquidity = parseFloat(liquidityMatch[1]);
      }
      
      // Extract base reserve
      const baseReserveMatch = log.match(/baseReserve:\s*([0-9]+)/i);
      if (baseReserveMatch) {
        poolData.baseReserve = parseInt(baseReserveMatch[1]);
      }
      
      // Extract quote reserve
      const quoteReserveMatch = log.match(/quoteReserve:\s*([0-9]+)/i);
      if (quoteReserveMatch) {
        poolData.quoteReserve = parseInt(quoteReserveMatch[1]);
      }
      
      // Extract virtual reserve (Meteora specific)
      const virtualReserveMatch = log.match(/virtualReserve:\s*([0-9]+)/i);
      if (virtualReserveMatch) {
        poolData.virtualReserve = parseInt(virtualReserveMatch[1]);
      }
      
      // Extract bonding curve parameters
      const curveMatch = log.match(/bondingCurve:\s*([0-9.]+)/i);
      if (curveMatch) {
        poolData.bondingCurve = parseFloat(curveMatch[1]);
      }
    }
    
    return poolData;
  }

  private async extractDeveloperFromTransaction(signature: string): Promise<PublicKey | null> {
    try {
      console.log(`🔍 Fetching blockchain transaction: ${signature}`);
      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      if (!transaction || !transaction.meta) {
        console.log(`❌ Transaction not found: ${signature}`);
        return null;
      }

      // Check fee payer (often the creator)
      const accountKeys = transaction.transaction.message.getAccountKeys();
      if (accountKeys && accountKeys.length > 0) {
        const feePayer = accountKeys.get(0);
        if (feePayer) {
          console.log(`✅ Found fee payer: ${feePayer.toBase58()}`);
          return feePayer;
        }
      }

      // Check writable accounts for potential creators
      for (let i = 0; i < accountKeys.length; i++) {
        if (transaction.transaction.message.isAccountWritable(i)) {
          const account = accountKeys.get(i);
          if (account) {
            console.log(`✅ Found writable account: ${account.toBase58()}`);
            return account;
          }
        }
      }

      console.log(`❌ No developer address found in blockchain data for ${signature}`);
      return null;
      
    } catch (error) {
      console.error('Error extracting developer from Meteora transaction:', error);
      return null;
    }
  }

  // Meteora methods - simplified placeholder
  private async getPools(): Promise<any[]> {
    try {
      // Placeholder: Would get pools from on-chain data
      return [];
    } catch (error) {
      console.error('Error getting pools:', error);
      return [];
    }
  }

  private async getPoolByBaseMint(baseMint: PublicKey): Promise<any | null> {
    try {
      // Placeholder: Would find pool by mint
      return null;
    } catch (error) {
      console.error('Error getting pool by base mint:', error);
      return null;
    }
  }

  // Alternative monitoring approach: Poll for new accounts
  async pollForNewTokens(): Promise<void> {
    if (!this.isMonitoring) return;

    try {
      // Get program accounts for Meteora
      const accounts = await this.connection.getProgramAccounts(this.meteoraProgramId, {
        commitment: 'confirmed',
        filters: [
          {
            dataSize: 0 // Adjust based on actual account size
          }
        ]
      });

      console.log(`🔍 Found ${accounts.length} Meteora accounts`);
      
      // Analyze accounts for new tokens
      for (const account of accounts) {
        await this.analyzeMeteoraAccount(account.pubkey);
      }

    } catch (error) {
      console.error('Error polling Meteora accounts:', error);
    }
  }

  private async analyzeMeteoraAccount(accountPubkey: PublicKey): Promise<void> {
    try {
      const accountInfo = await this.connection.getAccountInfo(accountPubkey);
      
      if (!accountInfo) return;

      // Analyze account data to determine if it's a new token/pool
      // This requires understanding Meteora's account structure
      console.log(`🔍 Analyzing Meteora account: ${accountPubkey.toBase58()}`);
      
    } catch (error) {
      console.error('Error analyzing Meteora account:', error);
    }
  }
}
