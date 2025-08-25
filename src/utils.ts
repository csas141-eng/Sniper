import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

// Input validation utilities
export class ValidationError extends Error {
  constructor(message: string, public field: string, public value: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Type guards for input validation
export const isValidString = (value: any, fieldName: string, minLength = 1): string => {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName, value);
  }
  if (value.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters long`, fieldName, value);
  }
  return value;
};

export const isValidNumber = (value: any, fieldName: string, min?: number, max?: number): number => {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a valid number`, fieldName, value);
  }
  if (min !== undefined && value < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`, fieldName, value);
  }
  if (max !== undefined && value > max) {
    throw new ValidationError(`${fieldName} must be at most ${max}`, fieldName, value);
  }
  return value;
};

export const isValidPublicKey = (value: any, fieldName: string): PublicKey => {
  try {
    if (typeof value === 'string') {
      return new PublicKey(value);
    } else if (value instanceof PublicKey) {
      return value;
    } else {
      throw new Error('Invalid type');
    }
  } catch (error) {
    throw new ValidationError(`${fieldName} must be a valid PublicKey`, fieldName, value);
  }
};

export const isValidConnection = (connection: any, fieldName: string = 'connection'): Connection => {
  if (!connection || typeof connection.getLatestBlockhash !== 'function') {
    throw new ValidationError(`${fieldName} must be a valid Connection instance`, fieldName, connection);
  }
  return connection;
};

/**
 * Pure, stateless utility functions for Solana operations
 * All functions include robust input validation and type guards
 */
export const SolanaUtils = {
  /**
   * Validate if a string is a valid token mint address
   */
  isValidTokenMint: (mintAddress: string): boolean => {
    try {
      isValidString(mintAddress, 'mintAddress', 32);
      new PublicKey(mintAddress);
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get token account balance (pure function - requires connection to be passed)
   */
  getTokenBalance: async (
    connection: Connection,
    tokenMint: string,
    walletAddress: string
  ): Promise<number> => {
    const validConnection = isValidConnection(connection);
    const validTokenMint = isValidString(tokenMint, 'tokenMint', 32);
    const validWalletAddress = isValidString(walletAddress, 'walletAddress', 32);

    try {
      const mint = new PublicKey(validTokenMint);
      const wallet = new PublicKey(validWalletAddress);
      const tokenAccount = await getAssociatedTokenAddress(mint, wallet);
      
      const accountInfo = await validConnection.getAccountInfo(tokenAccount);
      if (!accountInfo) return 0;

      // Parse token balance from account data
      // This is a simplified version - in practice, you'd need proper SPL token parsing
      return accountInfo.data.length;
    } catch (error) {
      throw new ValidationError(
        `Error getting token balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'tokenBalance',
        { tokenMint: validTokenMint, walletAddress: validWalletAddress }
      );
    }
  },

  /**
   * Get wallet SOL balance
   */
  getWalletBalance: async (connection: Connection, walletAddress: string): Promise<number> => {
    const validConnection = isValidConnection(connection);
    const validWalletAddress = isValidString(walletAddress, 'walletAddress', 32);

    try {
      const wallet = new PublicKey(validWalletAddress);
      const balance = await validConnection.getBalance(wallet);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      throw new ValidationError(
        `Error getting wallet balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'walletBalance',
        walletAddress
      );
    }
  },

  /**
   * Validate developer address
   */
  validateDeveloperAddress: async (connection: Connection, address: string): Promise<boolean> => {
    const validConnection = isValidConnection(connection);
    const validAddress = isValidString(address, 'address', 32);

    try {
      const pubkey = new PublicKey(validAddress);
      const accountInfo = await validConnection.getAccountInfo(pubkey);
      return accountInfo !== null;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get recent transactions for an address
   */
  getRecentTransactions: async (
    connection: Connection,
    address: string,
    limit: number = 10
  ): Promise<any[]> => {
    const validConnection = isValidConnection(connection);
    const validAddress = isValidString(address, 'address', 32);
    const validLimit = isValidNumber(limit, 'limit', 1, 1000);

    try {
      const pubkey = new PublicKey(validAddress);
      const signatures = await validConnection.getSignaturesForAddress(pubkey, { limit: validLimit });
      
      const transactions = await Promise.all(
        signatures.map(async (sig) => {
          try {
            const tx = await validConnection.getTransaction(sig.signature, {
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
      throw new ValidationError(
        `Error getting recent transactions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'recentTransactions',
        { address: validAddress, limit: validLimit }
      );
    }
  },

  /**
   * Check RPC health
   */
  checkRPCHealth: async (connection: Connection): Promise<{ healthy: boolean; responseTime: number }> => {
    const validConnection = isValidConnection(connection);

    try {
      const startTime = Date.now();
      await validConnection.getLatestBlockhash();
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: responseTime < 5000, // 5 second threshold
        responseTime
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: -1
      };
    }
  },

  /**
   * Estimate transaction fees (pure calculation)
   */
  estimateTransactionFee: (instructionCount: number, priorityFee: number = 0): number => {
    const validInstructionCount = isValidNumber(instructionCount, 'instructionCount', 0);
    const validPriorityFee = isValidNumber(priorityFee, 'priorityFee', 0);

    const baseFee = 5000; // Base fee in lamports
    const instructionFee = validInstructionCount * 200; // Per instruction fee
    return (baseFee + instructionFee + validPriorityFee) / 1e9; // Convert to SOL
  },

  /**
   * Format SOL amount (pure function)
   */
  formatSOL: (lamports: number, decimals: number = 9): string => {
    const validLamports = isValidNumber(lamports, 'lamports', 0);
    const validDecimals = isValidNumber(decimals, 'decimals', 0, 18);
    
    return (validLamports / 1e9).toFixed(validDecimals);
  },

  /**
   * Format token amount (pure function)
   */
  formatTokenAmount: (amount: number, decimals: number = 9): string => {
    const validAmount = isValidNumber(amount, 'amount', 0);
    const validDecimals = isValidNumber(decimals, 'decimals', 0, 18);
    
    return (validAmount / Math.pow(10, validDecimals)).toFixed(validDecimals);
  },

  /**
   * Generate performance report
   */
  generatePerformanceReport: async (connection: Connection): Promise<{
    timestamp: string;
    rpcHealth: { healthy: boolean; responseTime: number };
    latestBlockhash: string;
    slot: number;
    connection: string;
  }> => {
    const validConnection = isValidConnection(connection);

    try {
      const rpcHealth = await SolanaUtils.checkRPCHealth(validConnection);
      const latestBlockhash = await validConnection.getLatestBlockhash();
      
      return {
        timestamp: new Date().toISOString(),
        rpcHealth,
        latestBlockhash: latestBlockhash.blockhash,
        slot: latestBlockhash.lastValidBlockHeight,
        connection: validConnection.rpcEndpoint
      };
    } catch (error) {
      throw new ValidationError(
        `Error generating performance report: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'performanceReport',
        connection.rpcEndpoint
      );
    }
  },

  /**
   * Calculate slippage amount (pure function)
   */
  calculateSlippageAmount: (amount: number, slippage: number): number => {
    const validAmount = isValidNumber(amount, 'amount', 0);
    const validSlippage = isValidNumber(slippage, 'slippage', 0, 1);
    
    return validAmount * validSlippage;
  },

  /**
   * Calculate minimum out amount with slippage (pure function)
   */
  calculateMinimumOut: (expectedOut: number, slippage: number): number => {
    const validExpectedOut = isValidNumber(expectedOut, 'expectedOut', 0);
    const validSlippage = isValidNumber(slippage, 'slippage', 0, 1);
    
    return validExpectedOut * (1 - validSlippage);
  },

  /**
   * Validate transaction signature format (pure function)
   */
  isValidTransactionSignature: (signature: string): boolean => {
    try {
      const validSignature = isValidString(signature, 'signature', 64);
      // Solana transaction signatures are base58 encoded and roughly 88 characters
      return validSignature.length >= 64 && validSignature.length <= 128;
    } catch (error) {
      return false;
    }
  },

  /**
   * Run comprehensive diagnostics
   */
  runDiagnostics: async (connection: Connection): Promise<{
    rpcHealth: { healthy: boolean; responseTime: number };
    performanceReport: any;
    timestamp: string;
  }> => {
    const validConnection = isValidConnection(connection);

    const rpcHealth = await SolanaUtils.checkRPCHealth(validConnection);
    const performanceReport = await SolanaUtils.generatePerformanceReport(validConnection);

    return {
      rpcHealth,
      performanceReport,
      timestamp: new Date().toISOString()
    };
  }
};

// Deprecated class kept for backward compatibility - use SolanaUtils instead
export class SniperBotUtils {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = isValidConnection(connection, 'connection');
    console.warn('SniperBotUtils is deprecated. Use SolanaUtils instead for pure, stateless functions.');
  }

  async isValidTokenMint(mintAddress: string): Promise<boolean> {
    return SolanaUtils.isValidTokenMint(mintAddress);
  }

  async getTokenBalance(tokenMint: string, walletAddress: string): Promise<number> {
    return SolanaUtils.getTokenBalance(this.connection, tokenMint, walletAddress);
  }

  async getWalletBalance(walletAddress: string): Promise<number> {
    return SolanaUtils.getWalletBalance(this.connection, walletAddress);
  }

  async validateDeveloperAddress(address: string): Promise<boolean> {
    return SolanaUtils.validateDeveloperAddress(this.connection, address);
  }

  async getRecentTransactions(address: string, limit: number = 10): Promise<any[]> {
    return SolanaUtils.getRecentTransactions(this.connection, address, limit);
  }

  async checkRPCHealth(): Promise<boolean> {
    const health = await SolanaUtils.checkRPCHealth(this.connection);
    return health.healthy;
  }

  async estimateTransactionFee(instructions: any[]): Promise<number> {
    return SolanaUtils.estimateTransactionFee(instructions.length);
  }

  formatSOL(lamports: number): string {
    return SolanaUtils.formatSOL(lamports);
  }

  formatTokenAmount(amount: number, decimals: number = 9): string {
    return SolanaUtils.formatTokenAmount(amount, decimals);
  }

  async generatePerformanceReport(): Promise<any> {
    return SolanaUtils.generatePerformanceReport(this.connection);
  }

  async runDiagnostics(): Promise<void> {
    console.log('🔍 Running Sniper Bot Diagnostics...\n');

    const results = await SolanaUtils.runDiagnostics(this.connection);
    
    console.log('1. Checking RPC Health...');
    console.log(`   RPC Health: ${results.rpcHealth.healthy ? '✅ Healthy' : '❌ Unhealthy'} (${results.rpcHealth.responseTime}ms)\n`);

    console.log('2. Performance Report:');
    console.log('   ', JSON.stringify(results.performanceReport, null, 2), '\n');

    console.log('🏁 Diagnostics Complete!');
  }

  // Deprecated methods removed in favor of pure functions
  async monitorToken(tokenMint: string, duration: number = 60000): Promise<void> {
    console.warn('monitorToken is deprecated and has been removed for stateless architecture');
  }
}

