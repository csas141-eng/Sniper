import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import fs from 'fs';

// Load configuration from config.json
const loadConfig = () => {
  try {
    const configData = fs.readFileSync('./config.json', 'utf8');
    const userConfig = JSON.parse(configData);
    
    return {
      SOLANA_RPC_URL: userConfig.solanaRpcUrl
    };
  } catch (error) {
    console.error('Error loading config.json, using defaults:', error);
    return {};
  }
};

const CONFIG = loadConfig();

export interface SimulationResult {
  success: boolean;
  error?: string;
  logs?: string[];
  unitsConsumed?: number;
  fee?: number;
}

export class TransactionSimulator {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  // Simulate transaction before sending
  async simulateTransaction(transaction: Transaction): Promise<SimulationResult> {
    try {
      console.log('🔍 Simulating transaction...');
      
      // Get recent blockhash for simulation
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      
      // Simulate the transaction
      const simulation = await this.connection.simulateTransaction(transaction, []);
      
      if (simulation.value.err) {
        return {
          success: false,
          error: `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
          logs: simulation.value.logs || [],
          unitsConsumed: simulation.value.unitsConsumed || 0
        };
      }
      
      console.log(`✅ Transaction simulation successful (${simulation.value.unitsConsumed || 0} units)`);
      
      return {
        success: true,
        logs: simulation.value.logs || [],
        unitsConsumed: simulation.value.unitsConsumed || 0
      };
    } catch (error) {
      return {
        success: false,
        error: `Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Validate transaction for common issues
  validateTransaction(transaction: Transaction): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check if transaction has instructions
    if (transaction.instructions.length === 0) {
      errors.push('Transaction has no instructions');
    }
    
    // Check if transaction has recent blockhash
    if (!transaction.recentBlockhash) {
      errors.push('Transaction missing recent blockhash');
    }
    
    // Check if transaction has fee payer
    if (!transaction.feePayer) {
      errors.push('Transaction missing fee payer');
    }
    
    // Check instruction sizes
    transaction.instructions.forEach((instruction, index) => {
      if (instruction.data.length > 10_000) {
        errors.push(`Instruction ${index} data too large: ${instruction.data.length} bytes`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Estimate transaction cost
  async estimateTransactionCost(transaction: Transaction): Promise<{ fee: number; units: number }> {
    try {
      const simulation = await this.simulateTransaction(transaction);
      
      if (!simulation.success) {
        throw new Error(simulation.error);
      }
      
      return {
        fee: 0.001, // Default fee estimate
        units: simulation.unitsConsumed || 0
      };
    } catch (error) {
      console.warn('Failed to estimate transaction cost:', error);
      return { fee: 0.001, units: 200_000 }; // Default fallback
    }
  }

  // Check if transaction is likely to succeed
  async isTransactionLikelyToSucceed(transaction: Transaction): Promise<boolean> {
    try {
      const simulation = await this.simulateTransaction(transaction);
      return simulation.success;
    } catch (error) {
      console.warn('Failed to check transaction success likelihood:', error);
      return false;
    }
  }
}

// Service instance will be created by SniperBot
