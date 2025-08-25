import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

export interface ParsedTransaction {
  solChanges: number;
  tokenChanges: number;
  isBuy: boolean;
  user: string;
  mint: string;
  pool: string;
  liquidity: number;
  coinCreator?: string;
  context?: any;
}

export interface InstructionData {
  data: string;
  programId: string;
  accounts: string[];
}

export class TransactionParser {
  
  // Parse complex transaction data
  async parseTransactionData(transaction: any): Promise<ParsedTransaction | null> {
    try {
      const meta = transaction.meta;
      if (!meta) return null;

      const innerInstructions = meta.innerInstructions || [];
      
      // Flatten and analyze all instructions
      const allInstructions = innerInstructions.flatMap((ix: any) => ix.instructions || []);
      const validInstructions = allInstructions.filter((ix: any) => ix && ix.data);
      
      if (validInstructions.length === 0) return null;
      
      // Find largest data instruction (usually the main swap)
      const largestInstruction = validInstructions.reduce((largest: any, current: any) => 
        current.data.length > largest.data.length ? current : current
      );
      
      // Parse instruction data
      const rawData = bs58.decode(largestInstruction.data);
      const buffer = Buffer.from(rawData);
      
      return this.parseInstructionBuffer(buffer);
    } catch (error) {
      console.error('Error parsing transaction data:', error);
      return null;
    }
  }

  // Parse instruction buffer for detailed information
  private parseInstructionBuffer(buffer: Buffer): ParsedTransaction {
    try {
      // Parse SPL token data, pool information, amounts
      const solChanges = this.readBigUint64LE(buffer, 64);
      const tokenChanges = this.readBigUint64LE(buffer, 72);
      
      return {
        solChanges: Number(solChanges),
        tokenChanges: Number(tokenChanges),
        isBuy: this.isBuyTransaction(buffer),
        user: this.extractUserAddress(buffer),
        mint: this.extractTokenMint(buffer),
        pool: this.extractPoolAddress(buffer),
        liquidity: this.calculateLiquidity(buffer),
        coinCreator: this.extractCoinCreator(buffer),
        context: this.extractContext(buffer)
      };
    } catch (error) {
      console.error('Error parsing instruction buffer:', error);
      return this.createDefaultParsedTransaction();
    }
  }

  // Read 64-bit unsigned integer from buffer
  private readBigUint64LE(buffer: Buffer, offset: number): bigint {
    if (offset + 8 > buffer.length) return 0n;
    
    const bytes = buffer.slice(offset, offset + 8);
    let value = 0n;
    
    for (let i = 0; i < 8; i++) {
      value += BigInt(bytes[i]) << BigInt(8 * i);
    }
    
    return value;
  }

  // Determine if transaction is a buy
  private isBuyTransaction(buffer: Buffer): boolean {
    try {
      // Look for buy indicators in the instruction data
      const instructionType = this.readBigUint64LE(buffer, 0);
      
      // Common buy instruction discriminators
      const buyDiscriminators = [
        0x0f4a0c0c0c0c0c0cn, // Example buy discriminator
        0x1a0c0c0c0c0c0c0cn, // Another example
      ];
      
      return buyDiscriminators.includes(instructionType);
    } catch {
      // Fallback: assume it's a buy if we can't determine
      return true;
    }
  }

  // Extract user address from buffer
  private extractUserAddress(buffer: Buffer): string {
    try {
      // User address is typically at offset 8-40
      const addressBytes = buffer.slice(8, 40);
      return new PublicKey(addressBytes).toBase58();
    } catch {
      return 'unknown';
    }
  }

  // Extract token mint from buffer
  private extractTokenMint(buffer: Buffer): string {
    try {
      // Token mint is typically at offset 40-72
      const mintBytes = buffer.slice(40, 72);
      return new PublicKey(mintBytes).toBase58();
    } catch {
      return 'unknown';
    }
  }

  // Extract pool address from buffer
  private extractPoolAddress(buffer: Buffer): string {
    try {
      // Pool address is typically at offset 72-104
      const poolBytes = buffer.slice(72, 104);
      return new PublicKey(poolBytes).toBase58();
    } catch {
      return 'unknown';
    }
  }

  // Calculate liquidity from buffer
  private calculateLiquidity(buffer: Buffer): number {
    try {
      // Liquidity information might be at various offsets
      const liquidity1 = this.readBigUint64LE(buffer, 104);
      const liquidity2 = this.readBigUint64LE(buffer, 112);
      
      // Return the larger liquidity value
      return Number(liquidity1 > liquidity2 ? liquidity1 : liquidity2);
    } catch {
      return 0;
    }
  }

  // Extract coin creator from buffer
  private extractCoinCreator(buffer: Buffer): string {
    try {
      // Creator information might be at offset 120-152
      const creatorBytes = buffer.slice(120, 152);
      return new PublicKey(creatorBytes).toBase58();
    } catch {
      return 'unknown';
    }
  }

  // Extract additional context from buffer
  private extractContext(buffer: Buffer): any {
    try {
      return {
        bufferLength: buffer.length,
        hasAdditionalData: buffer.length > 152,
        timestamp: Date.now()
      };
    } catch {
      return {};
    }
  }

  // Create default parsed transaction when parsing fails
  private createDefaultParsedTransaction(): ParsedTransaction {
    return {
      solChanges: 0,
      tokenChanges: 0,
      isBuy: true,
      user: 'unknown',
      mint: 'unknown',
      pool: 'unknown',
      liquidity: 0,
      coinCreator: 'unknown',
      context: {}
    };
  }

  // Parse transaction logs for additional information
  parseTransactionLogs(logs: string[]): any {
    try {
      const parsedLogs: any = {
        mintTo: false,
        transfer: false,
        swap: false,
        createAccount: false,
        instructions: []
      };

      for (const log of logs) {
        if (log.toLowerCase().includes('instruction: mintto')) {
          parsedLogs.mintTo = true;
        }
        if (log.toLowerCase().includes('instruction: transfer')) {
          parsedLogs.transfer = true;
        }
        if (log.toLowerCase().includes('instruction: swap')) {
          parsedLogs.swap = true;
        }
        if (log.toLowerCase().includes('instruction: createaccount')) {
          parsedLogs.createAccount = true;
        }
        
        parsedLogs.instructions.push(log);
      }

      return parsedLogs;
    } catch (error) {
      console.error('Error parsing transaction logs:', error);
      return { instructions: logs };
    }
  }

  // Extract developer address from transaction
  extractDeveloperFromTransaction(transaction: any): string | null {
    try {
      // Try to extract developer from various sources
      const sources = [
        () => this.extractFromFeePayer(transaction),
        () => this.extractFromWritableAccounts(transaction),
        () => this.extractFromInstructionData(transaction),
        () => this.extractFromAccountChanges(transaction)
      ];

      for (const source of sources) {
        try {
          const developer = source();
          if (developer) return developer;
        } catch (error) {
          // Continue to next source
        }
      }

      return null;
    } catch (error) {
      console.error('Error extracting developer from transaction:', error);
      return null;
    }
  }

  // Extract developer from fee payer
  private extractFromFeePayer(transaction: any): string | null {
    try {
      const message = transaction.transaction?.message;
      if (message?.getAccountKeys) {
        const accountKeys = message.getAccountKeys();
        if (accountKeys && accountKeys.length > 0) {
          return accountKeys.get(0)?.toBase58() || null;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  // Extract developer from writable accounts
  private extractFromWritableAccounts(transaction: any): string | null {
    try {
      const message = transaction.transaction?.message;
      if (message?.getAccountKeys) {
        const accountKeys = message.getAccountKeys();
        for (let i = 0; i < accountKeys.length; i++) {
          if (message.isAccountWritable(i)) {
            const account = accountKeys.get(i);
            if (account) {
              return account.toBase58();
            }
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  // Extract developer from instruction data
  private extractFromInstructionData(transaction: any): string | null {
    try {
      const instructions = transaction.transaction?.message?.instructions || [];
      for (const instruction of instructions) {
        if (instruction.data && instruction.data.length > 0) {
          // Look for public key patterns in instruction data
          const data = bs58.decode(instruction.data);
          if (data.length >= 32) {
            const potentialKey = data.slice(0, 32);
            try {
              return new PublicKey(potentialKey).toBase58();
            } catch {
              // Continue to next instruction
            }
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  // Extract developer from account changes
  private extractFromAccountChanges(transaction: any): string | null {
    try {
      const accountKeys = transaction.transaction?.message?.accountKeys || [];
      for (const account of accountKeys) {
        if (typeof account === 'string') {
          return account;
        } else if (account?.toBase58) {
          return account.toBase58();
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const transactionParser = new TransactionParser();
