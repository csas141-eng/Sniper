import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { logger } from './structured-logger';
import { retryService } from './retry-service';

export interface BalanceCheckResult {
  address: string;
  balance: number;
  balanceSOL?: number;
  tokenBalance?: number;
  valid: boolean;
  reason?: string;
}

export interface IssuerValidationResult {
  issuer: string;
  tokenMint: string;
  solBalance: number;
  tokenBalance: number;
  isValid: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
  recommendations: string[];
}

/**
 * Balance validation service to check issuer and token balances before trading
 */
export class BalanceValidator {
  private connection: Connection;
  private cache: Map<string, { result: BalanceCheckResult; timestamp: number }> = new Map();
  private cacheTimeout: number = 30000; // 30 seconds

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Validate issuer balance before allowing trade
   */
  async validateIssuerBalance(
    issuerAddress: string, 
    tokenMint: string,
    minSOLBalance: number = 0.001,
    minTokenBalance: number = 0
  ): Promise<IssuerValidationResult> {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    try {
      logger.info(`🔍 Validating issuer balance: ${issuerAddress}`);

      // Check SOL balance
      const solBalance = await this.getSOLBalance(issuerAddress);
      
      // Check token balance if token mint provided
      let tokenBalance = 0;
      if (tokenMint) {
        tokenBalance = await this.getTokenBalance(issuerAddress, tokenMint);
      }

      // Validate SOL balance
      if (solBalance === 0) {
        warnings.push('Issuer has zero SOL balance');
        recommendations.push('Avoid trading with zero-balance issuers');
        riskLevel = 'high';
      } else if (solBalance < minSOLBalance) {
        warnings.push(`Issuer SOL balance (${solBalance}) below minimum (${minSOLBalance})`);
        recommendations.push('Consider increasing minimum balance threshold');
        riskLevel = 'medium';
      }

      // Validate token balance
      if (tokenMint && tokenBalance < minTokenBalance) {
        warnings.push(`Issuer token balance (${tokenBalance}) below minimum (${minTokenBalance})`);
        riskLevel = Math.max(riskLevel === 'low' ? 1 : riskLevel === 'medium' ? 2 : 3, 2) === 2 ? 'medium' : 'high';
      }

      // Additional risk factors
      if (solBalance > 0 && solBalance < 0.0001) {
        warnings.push('Issuer has very low SOL balance - may indicate dust account');
        riskLevel = 'medium';
      }

      // Check for suspicious patterns
      if (this.isSuspiciousBalance(solBalance, tokenBalance)) {
        warnings.push('Balance pattern suggests potential risk');
        recommendations.push('Manual review recommended');
        riskLevel = 'high';
      }

      const isValid = warnings.length === 0 || riskLevel !== 'high';

      const result: IssuerValidationResult = {
        issuer: issuerAddress,
        tokenMint,
        solBalance,
        tokenBalance,
        isValid,
        riskLevel,
        warnings,
        recommendations
      };

      // Log result
      if (isValid) {
        logger.info(`✅ Issuer validation passed`, {
          issuer: issuerAddress,
          solBalance,
          tokenBalance,
          riskLevel
        });
      } else {
        logger.warn(`❌ Issuer validation failed`, {
          issuer: issuerAddress,
          solBalance,
          tokenBalance,
          riskLevel,
          warnings
        });
      }

      return result;

    } catch (error) {
      logger.error('Error validating issuer balance', {
        issuer: issuerAddress,
        tokenMint,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        issuer: issuerAddress,
        tokenMint,
        solBalance: 0,
        tokenBalance: 0,
        isValid: false,
        riskLevel: 'high',
        warnings: ['Failed to validate issuer balance'],
        recommendations: ['Manual verification required']
      };
    }
  }

  /**
   * Get SOL balance for address
   */
  async getSOLBalance(address: string): Promise<number> {
    const cacheKey = `sol:${address}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached.balance;
    }

    try {
      const publicKey = new PublicKey(address);
      const balance = await retryService.executeWithRetry(
        () => this.connection.getBalance(publicKey),
        { apiName: 'solana', operation: 'balance-check' }
      );

      const balanceSOL = (balance as number) / LAMPORTS_PER_SOL;
      
      const result: BalanceCheckResult = {
        address,
        balance: balanceSOL,
        balanceSOL,
        valid: true
      };

      this.cacheResult(cacheKey, result);
      return balanceSOL;

    } catch (error) {
      logger.error('Error getting SOL balance', {
        address,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * Get token balance for address
   */
  async getTokenBalance(address: string, tokenMint: string): Promise<number> {
    const cacheKey = `token:${address}:${tokenMint}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached.tokenBalance || 0;
    }

    try {
      const walletPublicKey = new PublicKey(address);
      const tokenPublicKey = new PublicKey(tokenMint);

      // Get associated token account
      const associatedTokenAccount = await getAssociatedTokenAddress(
        tokenPublicKey,
        walletPublicKey
      );

      // Check if account exists and get balance
      const accountInfo = await retryService.executeWithRetry(
        () => this.connection.getAccountInfo(associatedTokenAccount),
        { apiName: 'solana', operation: 'token-balance-check' }
      );

      if (!accountInfo) {
        // Account doesn't exist, balance is 0
        const result: BalanceCheckResult = {
          address,
          balance: 0,
          tokenBalance: 0,
          valid: true,
          reason: 'Token account does not exist'
        };
        this.cacheResult(cacheKey, result);
        return 0;
      }

      // Parse token account to get balance
      const accountData = await retryService.executeWithRetry(
        () => getAccount(this.connection, associatedTokenAccount),
        { apiName: 'solana', operation: 'token-account-data' }
      );

      const tokenBalance = Number((accountData as any).amount);

      const result: BalanceCheckResult = {
        address,
        balance: tokenBalance,
        tokenBalance,
        valid: true
      };

      this.cacheResult(cacheKey, result);
      return tokenBalance;

    } catch (error) {
      logger.error('Error getting token balance', {
        address,
        tokenMint,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      const result: BalanceCheckResult = {
        address,
        balance: 0,
        tokenBalance: 0,
        valid: false,
        reason: 'Failed to fetch token balance'
      };

      this.cacheResult(cacheKey, result);
      return 0;
    }
  }

  /**
   * Validate multiple addresses at once
   */
  async validateMultipleBalances(
    addresses: string[],
    tokenMint?: string,
    minSOLBalance: number = 0.001
  ): Promise<{ valid: string[]; invalid: Array<{ address: string; reason: string }> }> {
    const valid: string[] = [];
    const invalid: Array<{ address: string; reason: string }> = [];

    await Promise.all(
      addresses.map(async (address) => {
        try {
          const result = await this.validateIssuerBalance(address, tokenMint || '', minSOLBalance);
          
          if (result.isValid) {
            valid.push(address);
          } else {
            invalid.push({
              address,
              reason: result.warnings.join(', ') || 'Validation failed'
            });
          }
        } catch (error) {
          invalid.push({
            address,
            reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      })
    );

    return { valid, invalid };
  }

  /**
   * Check if balance pattern is suspicious
   */
  private isSuspiciousBalance(solBalance: number, tokenBalance: number): boolean {
    // Define suspicious patterns
    const patterns = [
      // Exact zero balances (could be drained accounts)
      solBalance === 0 && tokenBalance === 0,
      
      // Very specific small amounts that might indicate automated behavior
      solBalance > 0 && solBalance < 0.00001,
      
      // Unusual balance ratios
      tokenBalance > 0 && solBalance === 0 // Has tokens but no SOL for fees
    ];

    return patterns.some(pattern => pattern);
  }

  /**
   * Get cached balance result
   */
  private getCachedResult(key: string): BalanceCheckResult | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.result;
    }
    return null;
  }

  /**
   * Cache balance result
   */
  private cacheResult(key: string, result: BalanceCheckResult): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    if (this.cache.size > 1000) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 25% of entries
      const toRemove = Math.floor(entries.length * 0.25);
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Balance validation cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    // This would require tracking hits/misses - simplified for now
    return {
      size: this.cache.size,
      hitRate: 0 // Placeholder
    };
  }

  /**
   * Pre-validate a list of addresses for better performance
   */
  async preValidateAddresses(addresses: string[], tokenMint?: string): Promise<void> {
    logger.info(`🔄 Pre-validating ${addresses.length} addresses`);
    
    // Batch validate in chunks to avoid overwhelming the RPC
    const chunkSize = 10;
    for (let i = 0; i < addresses.length; i += chunkSize) {
      const chunk = addresses.slice(i, i + chunkSize);
      await this.validateMultipleBalances(chunk, tokenMint);
      
      // Small delay to be respectful to RPC
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logger.info(`✅ Pre-validation completed for ${addresses.length} addresses`);
  }
}

// Export a function to create validator instance
export const createBalanceValidator = (connection: Connection) => new BalanceValidator(connection);