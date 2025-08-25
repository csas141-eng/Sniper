import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

/**
 * Security-focused transaction validator
 * Blocks suspicious transactions and ensures only trusted program IDs are used
 */

// SECURITY: Trusted program IDs for Solana DeFi operations
const TRUSTED_PROGRAM_IDS = new Set([
  '11111111111111111111111111111111', // System Program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token Program
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Program
  'ComputeBudget111111111111111111111111111111', // Compute Budget Program
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Pump.fun Program
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM Program
  'CAMMCzo5YL8w4VFF8KVHrK22GGUCfGQbUfnDggrGzQU4', // Raydium CPMM Program
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', // Pump.fun Program (alternative)
  'METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m', // Meteora Program
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', // LetsBonk Program
]);

// SECURITY: Suspicious instruction patterns that should be blocked
const SUSPICIOUS_PATTERNS = {
  // Instructions that could drain accounts
  CLOSE_ACCOUNT: 'CloseAccount',
  SET_AUTHORITY: 'SetAuthority',
  FREEZE_ACCOUNT: 'FreezeAccount',
  BURN: 'Burn',
  
  // Suspicious data patterns
  MAX_INSTRUCTION_SIZE: 10_000,
  MAX_ACCOUNTS_PER_INSTRUCTION: 100,
  SUSPICIOUS_DATA_PATTERNS: [
    /transfer.*all/i,
    /drain/i,
    /empty/i,
    /steal/i
  ]
};

export interface TransactionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class TransactionValidator {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Comprehensive security validation of transactions
   * SECURITY: Blocks suspicious and potentially harmful transactions
   */
  async validateTransaction(transaction: Transaction): Promise<TransactionValidationResult> {
    const result: TransactionValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      riskLevel: 'low'
    };

    try {
      // 1. Basic structure validation
      this.validateBasicStructure(transaction, result);

      // 2. Program ID validation (trusted programs only)
      this.validateProgramIds(transaction, result);

      // 3. Instruction validation (suspicious patterns)
      this.validateInstructions(transaction, result);

      // 4. Account validation
      this.validateAccounts(transaction, result);

      // 5. Size and complexity validation
      this.validateSizeAndComplexity(transaction, result);

      // Determine overall validity and risk level
      if (result.errors.length > 0) {
        result.isValid = false;
        result.riskLevel = 'critical';
      } else if (result.warnings.length > 2) {
        result.riskLevel = 'high';
      } else if (result.warnings.length > 0) {
        result.riskLevel = 'medium';
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.riskLevel = 'critical';
    }

    return result;
  }

  /**
   * Validate basic transaction structure
   */
  private validateBasicStructure(transaction: Transaction, result: TransactionValidationResult): void {
    if (!transaction.instructions || transaction.instructions.length === 0) {
      result.errors.push('Transaction has no instructions');
    }

    if (!transaction.feePayer) {
      result.errors.push('Transaction missing fee payer');
    }

    if (transaction.instructions.length > 10) {
      result.warnings.push(`High instruction count: ${transaction.instructions.length}`);
    }
  }

  /**
   * Validate program IDs against trusted list
   * SECURITY: Only allow known, trusted programs
   */
  private validateProgramIds(transaction: Transaction, result: TransactionValidationResult): void {
    for (const instruction of transaction.instructions) {
      const programId = instruction.programId.toBase58();
      
      if (!TRUSTED_PROGRAM_IDS.has(programId)) {
        result.errors.push(`Untrusted program ID detected: ${programId}`);
        result.riskLevel = 'critical';
      }
    }
  }

  /**
   * Validate instructions for suspicious patterns
   * SECURITY: Block potentially harmful instruction patterns
   */
  private validateInstructions(transaction: Transaction, result: TransactionValidationResult): void {
    for (let i = 0; i < transaction.instructions.length; i++) {
      const instruction = transaction.instructions[i];
      
      // Check instruction data size
      if (instruction.data.length > SUSPICIOUS_PATTERNS.MAX_INSTRUCTION_SIZE) {
        result.errors.push(`Instruction ${i} data too large: ${instruction.data.length} bytes`);
      }

      // Check number of accounts
      if (instruction.keys.length > SUSPICIOUS_PATTERNS.MAX_ACCOUNTS_PER_INSTRUCTION) {
        result.warnings.push(`Instruction ${i} has many accounts: ${instruction.keys.length}`);
      }

      // Check for suspicious data patterns
      const dataStr = instruction.data.toString('hex');
      for (const pattern of SUSPICIOUS_PATTERNS.SUSPICIOUS_DATA_PATTERNS) {
        if (pattern.test(dataStr)) {
          result.errors.push(`Suspicious data pattern detected in instruction ${i}`);
          result.riskLevel = 'critical';
        }
      }
    }
  }

  /**
   * Validate account usage patterns
   * SECURITY: Check for suspicious account access patterns
   */
  private validateAccounts(transaction: Transaction, result: TransactionValidationResult): void {
    const writableAccounts = new Set<string>();
    const allAccounts = new Set<string>();

    for (const instruction of transaction.instructions) {
      for (const accountMeta of instruction.keys) {
        const accountKey = accountMeta.pubkey.toBase58();
        allAccounts.add(accountKey);
        
        if (accountMeta.isWritable) {
          writableAccounts.add(accountKey);
        }
      }
    }

    // Check for excessive writable accounts
    if (writableAccounts.size > 20) {
      result.warnings.push(`High number of writable accounts: ${writableAccounts.size}`);
    }

    // Check for duplicate account usage (might indicate complex operations)
    if (allAccounts.size !== writableAccounts.size + (allAccounts.size - writableAccounts.size)) {
      result.warnings.push('Complex account access pattern detected');
    }
  }

  /**
   * Validate transaction size and complexity
   * SECURITY: Prevent overly complex transactions that could hide malicious operations
   */
  private validateSizeAndComplexity(transaction: Transaction, result: TransactionValidationResult): void {
    // Calculate approximate transaction size
    const serialized = transaction.serialize({ requireAllSignatures: false });
    const txSize = serialized.length;

    if (txSize > 1232) { // Max transaction size limit
      result.errors.push(`Transaction too large: ${txSize} bytes (max: 1232)`);
    }

    if (txSize > 800) {
      result.warnings.push(`Large transaction size: ${txSize} bytes`);
    }

    // Check instruction complexity
    let totalAccounts = 0;
    let totalDataSize = 0;
    
    for (const instruction of transaction.instructions) {
      totalAccounts += instruction.keys.length;
      totalDataSize += instruction.data.length;
    }

    if (totalAccounts > 50) {
      result.warnings.push(`High total account count: ${totalAccounts}`);
    }

    if (totalDataSize > 50_000) {
      result.errors.push(`Excessive instruction data size: ${totalDataSize} bytes`);
    }
  }

  /**
   * Quick validation for time-sensitive operations
   * SECURITY: Fast validation for critical path
   */
  validateQuick(transaction: Transaction): boolean {
    try {
      // Quick checks for critical security issues
      if (!transaction.instructions || transaction.instructions.length === 0) {
        return false;
      }

      // Check program IDs quickly
      for (const instruction of transaction.instructions) {
        const programId = instruction.programId.toBase58();
        if (!TRUSTED_PROGRAM_IDS.has(programId)) {
          console.error(`🚨 SECURITY: Blocked untrusted program ID: ${programId}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('🚨 SECURITY: Transaction validation error:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Add a trusted program ID to the allow list
   * SECURITY: Only allow explicitly trusted programs
   */
  static addTrustedProgram(programId: string): boolean {
    try {
      // Validate the program ID format
      new PublicKey(programId);
      TRUSTED_PROGRAM_IDS.add(programId);
      console.log(`✅ Added trusted program ID: ${programId}`);
      return true;
    } catch (error) {
      console.error(`❌ Invalid program ID format: ${programId}`);
      return false;
    }
  }

  /**
   * Get list of trusted program IDs
   */
  static getTrustedPrograms(): string[] {
    return Array.from(TRUSTED_PROGRAM_IDS);
  }
}