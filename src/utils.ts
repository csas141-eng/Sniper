import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

export class SniperBotUtils {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Check if a token mint is valid
   */
  async isValidTokenMint(mintAddress: string): Promise<boolean> {
    try {
      const mint = new PublicKey(mintAddress);
      const accountInfo = await this.connection.getAccountInfo(mint);
      return accountInfo !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get token account balance
   */
  async getTokenBalance(tokenMint: string, walletAddress: string): Promise<number> {
    try {
      const mint = new PublicKey(tokenMint);
      const wallet = new PublicKey(walletAddress);
      const tokenAccount = await getAssociatedTokenAddress(mint, wallet);
      
      const accountInfo = await this.connection.getAccountInfo(tokenAccount);
      if (!accountInfo) return 0;

      // Parse token balance from account data
      // This is a simplified version - you might need to implement proper SPL token parsing
      return accountInfo.data.length;
    } catch (error) {
      console.error('Error getting token balance:', error);
      return 0;
    }
  }

  /**
   * Check wallet balance
   */
  async getWalletBalance(walletAddress: string): Promise<number> {
    try {
      const wallet = new PublicKey(walletAddress);
      const balance = await this.connection.getBalance(wallet);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      return 0;
    }
  }

  /**
   * Validate developer address
   */
  async validateDeveloperAddress(address: string): Promise<boolean> {
    try {
      const pubkey = new PublicKey(address);
      const accountInfo = await this.connection.getAccountInfo(pubkey);
      return accountInfo !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get recent transactions for an address
   */
  async getRecentTransactions(address: string, limit: number = 10): Promise<any[]> {
    try {
      const pubkey = new PublicKey(address);
      const signatures = await this.connection.getSignaturesForAddress(pubkey, { limit });
      
      const transactions = await Promise.all(
        signatures.map(async (sig) => {
          try {
            const tx = await this.connection.getTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0
            });
            return {
              signature: sig.signature,
              slot: sig.slot,
              blockTime: sig.blockTime,
              transaction: tx
            };
          } catch (error) {
            return {
              signature: sig.signature,
              slot: sig.slot,
              blockTime: sig.blockTime,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        })
      );

      return transactions;
    } catch (error) {
      console.error('Error getting recent transactions:', error);
      return [];
    }
  }

  /**
   * Check RPC health
   */
  async checkRPCHealth(): Promise<boolean> {
    try {
      const startTime = Date.now();
      await this.connection.getLatestBlockhash();
      const responseTime = Date.now() - startTime;
      
      console.log(`RPC Response Time: ${responseTime}ms`);
      return responseTime < 5000; // 5 second timeout
    } catch (error) {
      console.error('RPC Health Check Failed:', error);
      return false;
    }
  }

  /**
   * Estimate transaction fees
   */
  async estimateTransactionFee(instructions: any[]): Promise<number> {
    try {
      // This is a simplified estimation
      // In practice, you'd need to simulate the transaction
      const baseFee = 5000; // Base fee in lamports
      const instructionFee = instructions.length * 200; // Per instruction fee
      return (baseFee + instructionFee) / 1e9; // Convert to SOL
    } catch (error) {
      console.error('Error estimating transaction fee:', error);
      return 0.001; // Default fallback
    }
  }

  /**
   * Format SOL amount
   */
  formatSOL(lamports: number): string {
    return (lamports / 1e9).toFixed(9);
  }

  /**
   * Format token amount
   */
  formatTokenAmount(amount: number, decimals: number = 9): string {
    return (amount / Math.pow(10, decimals)).toFixed(decimals);
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(): Promise<any> {
    try {
      const rpcHealth = await this.checkRPCHealth();
      const latestBlockhash = await this.connection.getLatestBlockhash();
      
      return {
        timestamp: new Date().toISOString(),
        rpcHealth,
        latestBlockhash: latestBlockhash.blockhash,
        slot: latestBlockhash.lastValidBlockHeight,
        connection: this.connection.rpcEndpoint
      };
    } catch (error) {
      console.error('Error generating performance report:', error);
      return {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Monitor specific token
   */
  async monitorToken(tokenMint: string, duration: number = 60000): Promise<void> {
    const mint = new PublicKey(tokenMint);
    const startTime = Date.now();
    
    console.log(`Monitoring token ${tokenMint} for ${duration}ms...`);
    
    const interval = setInterval(async () => {
      try {
        const accountInfo = await this.connection.getAccountInfo(mint);
        const elapsed = Date.now() - startTime;
        
        if (accountInfo) {
          console.log(`[${elapsed}ms] Token account exists, size: ${accountInfo.data.length} bytes`);
        } else {
          console.log(`[${elapsed}ms] Token account not found`);
        }
        
        if (elapsed >= duration) {
          clearInterval(interval);
          console.log('Token monitoring completed');
        }
      } catch (error) {
        console.error('Error monitoring token:', error);
      }
    }, 1000);
  }

  /**
   * Test connection and basic functionality
   */
  async runDiagnostics(): Promise<void> {
    console.log('🔍 Running Sniper Bot Diagnostics...\n');

    // Check RPC health
    console.log('1. Checking RPC Health...');
    const rpcHealth = await this.checkRPCHealth();
    console.log(`   RPC Health: ${rpcHealth ? '✅ Healthy' : '❌ Unhealthy'}\n`);

    // Get latest blockhash
    console.log('2. Checking Latest Blockhash...');
    try {
      const blockhash = await this.connection.getLatestBlockhash();
      console.log(`   Latest Blockhash: ${blockhash.blockhash}\n`);
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }

    // Generate performance report
    console.log('3. Generating Performance Report...');
    const report = await this.generatePerformanceReport();
    console.log('   Performance Report:', JSON.stringify(report, null, 2), '\n');

    console.log('🏁 Diagnostics Complete!');
  }
}

