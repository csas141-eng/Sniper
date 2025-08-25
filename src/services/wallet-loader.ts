/**
 * SECURE WALLET LOADER SERVICE
 * 
 * SECURITY FEATURES:
 * - Never logs private keys or secret data
 * - Validates wallet structure without exposing secrets
 * - Provides sanitized error messages
 * - Supports multiple wallet formats securely
 * 
 * BEST PRACTICES:
 * - Always use this service instead of loading wallets directly
 * - Private keys should never appear in logs or error messages
 * - Validate wallet integrity before use
 */

import { Keypair } from '@solana/web3.js';
import fs from 'fs';

/**
 * Secure wallet loading service
 * SECURITY: Never logs private keys or secrets
 */
export class WalletLoader {
  /**
   * Load wallet from private key array (from config.json)
   * SECURITY: No logging of private key data
   */
  static loadFromPrivateKey(privateKeyArray: number[]): Keypair {
    try {
      if (!Array.isArray(privateKeyArray) || privateKeyArray.length !== 64) {
        throw new Error('Invalid private key format: must be array of 64 numbers');
      }

      const secretKey = Uint8Array.from(privateKeyArray);
      const keypair = Keypair.fromSecretKey(secretKey);
      
      // SECURITY: Only log public key, never private key
      console.log(`✅ Wallet loaded successfully. Public key: ${keypair.publicKey.toBase58()}`);
      
      return keypair;
    } catch (error) {
      // SECURITY: Sanitized error logging - no secret exposure
      throw new Error(`Failed to load wallet from private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load wallet from JSON file
   * SECURITY: No logging of private key data
   */
  static loadFromFile(filePath: string): Keypair {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Wallet file not found: ${filePath}`);
      }

      const walletData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      let secretKey: Uint8Array;
      
      if (walletData.secretKey) {
        // Handle array format
        secretKey = Uint8Array.from(walletData.secretKey);
      } else if (typeof walletData === 'string') {
        // Handle base58 format
        const bs58 = require('bs58');
        secretKey = bs58.decode(walletData);
      } else {
        throw new Error('Unsupported wallet file format');
      }

      const keypair = Keypair.fromSecretKey(secretKey);
      
      // SECURITY: Only log public key, never private key
      console.log(`✅ Wallet loaded from file. Public key: ${keypair.publicKey.toBase58()}`);
      
      return keypair;
    } catch (error) {
      // SECURITY: Sanitized error logging - no secret exposure
      throw new Error(`Failed to load wallet from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate wallet keypair without logging secrets
   * SECURITY: Only validates structure, no secret logging
   */
  static validateWallet(keypair: Keypair): boolean {
    try {
      if (!keypair || !keypair.publicKey || !keypair.secretKey) {
        return false;
      }
      
      // Basic validation - ensure we can get public key
      const publicKeyStr = keypair.publicKey.toBase58();
      return publicKeyStr.length > 0;
    } catch {
      return false;
    }
  }
}