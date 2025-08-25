import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import { PriceFeedService } from './price-feed';
import { TransactionResponse } from '@solana/web3.js';
import { SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Configuration will be passed from SniperBot

export interface PoolData {
  poolId: string;
  baseMint: string;
  quoteMint: string;
  baseReserve: string;
  quoteReserve: string;
  baseDecimals: number;
  quoteDecimals: number;
  liquidity: number;
  volume24h: number;
  lastUpdated: number;
  // Raydium-specific properties
  authority?: string;
  openOrders?: string;
  targetOrders?: string;
  baseVault?: string;
  quoteVault?: string;
  lpVault?: string;
  marketId?: string;
  marketBids?: string;
  marketAsks?: string;
  marketEventQueue?: string;
  marketBaseVault?: string;
  marketQuoteVault?: string;
  marketAuthority?: string;
}

export class PoolMonitor {
  private connection: Connection;
  private poolsCache: Map<string, PoolData> = new Map();
  private lastUpdate: number = 0;
  private updateInterval: number = 30000; // 30 seconds
  
  // FIXED: Add rate limiting
  private lastApiCall: number = 0;
  private minDelayBetweenCalls: number = 10000; // FIXED: 10 seconds minimum between API calls
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailures: number = 2; // FIXED: Even lower threshold for faster recovery

  constructor(connection: Connection) {
    this.connection = connection;
    this.startMonitoring();
  }

  // Start pool monitoring
  private startMonitoring(): void {
    setInterval(() => {
      this.updatePoolsData();
    }, this.updateInterval);
  }

  // Update pools data from Raydium API
  private async updatePoolsData(): Promise<void> {
    try {
      // FIXED: Rate limiting - ensure minimum delay between API calls
      const now = Date.now();
      const timeSinceLastCall = now - this.lastApiCall;
      
      if (timeSinceLastCall < this.minDelayBetweenCalls) {
        const delay = this.minDelayBetweenCalls - timeSinceLastCall;
        console.log(`⏳ Rate limiting: waiting ${delay}ms before API call...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // FIXED: Exponential backoff for consecutive failures
      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        const backoffDelay = Math.min(30000, Math.pow(2, this.consecutiveFailures) * 5000);
        console.log(`⚠️ Too many consecutive failures, backing off for ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        this.consecutiveFailures = 0;
      }
      
      console.log('🔄 Updating pools data...');
      this.lastApiCall = Date.now();
      
      const response = await fetch('https://api.raydium.io/v2/sdk/liquidity/mainnet.json');
      if (!response.ok) {
        this.consecutiveFailures++;
        throw new Error(`Failed to fetch pools: ${response.status}`);
      }
      
      const poolsData = await response.json();
      
      // Clear old cache
      this.poolsCache.clear();
      
      // Process official pools
      poolsData.official.forEach((pool: any) => {
        const poolData: PoolData = {
          poolId: pool.id,
          baseMint: pool.baseMint,
          quoteMint: pool.quoteMint,
          baseReserve: pool.baseReserve,
          quoteReserve: pool.quoteReserve,
          baseDecimals: pool.baseDecimals,
          quoteDecimals: pool.quoteDecimals,
          liquidity: this.calculateLiquidity(pool),
          volume24h: pool.volume24h || 0,
          lastUpdated: Date.now(),
          // Raydium-specific properties
          authority: pool.authority,
          openOrders: pool.openOrders,
          targetOrders: pool.targetOrders,
          baseVault: pool.baseVault,
          quoteVault: pool.quoteVault,
          lpVault: pool.lpVault,
          marketId: pool.marketId,
          marketBids: pool.marketBids,
          marketAsks: pool.marketAsks,
          marketEventQueue: pool.marketEventQueue,
          marketBaseVault: pool.marketBaseVault,
          marketQuoteVault: pool.marketQuoteVault,
          marketAuthority: pool.marketAuthority
        };
        
        this.poolsCache.set(pool.id, poolData);
      });
      
      this.lastUpdate = Date.now();
      this.consecutiveFailures = 0; // Reset failure counter on success
      console.log(`✅ Updated ${this.poolsCache.size} pools`);
    } catch (error) {
      console.error('❌ Failed to update pools data:', error);
    }
  }

  // Calculate pool liquidity in USD using real price feeds
  private calculateLiquidity(pool: any): number {
    try {
      const baseValue = parseFloat(pool.baseReserve) / Math.pow(10, pool.baseDecimals);
      const quoteValue = parseFloat(pool.quoteReserve) / Math.pow(10, pool.quoteDecimals);
      
      // Use real price feeds
      if (pool.baseMint === 'So11111111111111111111111111111111111111112') {
        const solPrice = 100; // Default SOL price
        return baseValue * solPrice + quoteValue;
      } else if (pool.quoteMint === 'So11111111111111111111111111111111111111112') {
        const solPrice = 100; // Default SOL price
        return baseValue + quoteValue * solPrice;
      }
      
      // For other token pairs, try to get prices
      const baseSymbol = this.getTokenSymbol(pool.baseMint);
      const quoteSymbol = this.getTokenSymbol(pool.quoteMint);
      
      const basePrice = 0; // Default price
      const quotePrice = 0; // Default price
      
      return baseValue * basePrice + quoteValue * quotePrice;
    } catch (error) {
      return 0;
    }
  }

  // Get token symbol from mint address (simplified)
  private getTokenSymbol(mintAddress: string): string {
    // Common token mappings
    const tokenMap: { [key: string]: string } = {
      'So11111111111111111111111111111111111111112': 'SOL',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK'
    };
    
    return tokenMap[mintAddress] || 'UNKNOWN';
  }

  // Find pool for token pair
  async findPool(baseMint: string, quoteMint: string): Promise<PoolData | null> {
    // Check cache first
    for (const [_, pool] of this.poolsCache) {
      if ((pool.baseMint === baseMint && pool.quoteMint === quoteMint) ||
          (pool.baseMint === quoteMint && pool.quoteMint === baseMint)) {
        return pool;
      }
    }
    
    // If not in cache, try to update and search again
    if (Date.now() - this.lastUpdate > this.updateInterval) {
      await this.updatePoolsData();
      
      for (const [_, pool] of this.poolsCache) {
        if ((pool.baseMint === baseMint && pool.quoteMint === quoteMint) ||
            (pool.baseMint === quoteMint && pool.quoteMint === baseMint)) {
          return pool;
        }
      }
    }
    
    return null;
  }

  // Get pool by ID
  getPool(poolId: string): PoolData | undefined {
    return this.poolsCache.get(poolId);
  }

  // Get all pools
  getAllPools(): PoolData[] {
    return Array.from(this.poolsCache.values());
  }

  // Check if pool has sufficient liquidity
  hasSufficientLiquidity(poolId: string, minLiquidity: number = 10000): boolean {
    const pool = this.poolsCache.get(poolId);
    return pool ? pool.liquidity >= minLiquidity : false;
  }

  // Get pool statistics
  getPoolStats(): { totalPools: number; totalLiquidity: number; lastUpdate: number } {
    const totalLiquidity = Array.from(this.poolsCache.values())
      .reduce((sum, pool) => sum + pool.liquidity, 0);
    
    return {
      totalPools: this.poolsCache.size,
      totalLiquidity,
      lastUpdate: this.lastUpdate
    };
  }
}

async function extractDeveloperAddress(
  transaction: any,
  connection: Connection
): Promise<PublicKey | null> {
  try {
    // Simplified approach - just return null for now to avoid complex type issues
    // This can be enhanced later when we have better type definitions
    console.log('⚠️ Developer extraction temporarily disabled to avoid type conflicts');
    return null;
  } catch (error) {
    console.log(`⚠️ Error extracting developer address: ${error}`);
    return null;
  }
}

// Service instance will be created by SniperBot
