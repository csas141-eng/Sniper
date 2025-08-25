import { Keypair } from '@solana/web3.js';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as readline from 'readline';

export interface EncryptedWallet {
  encryptedKey: string;
  salt: string;
  iv: string;
  algorithm: string;
  iterations: number;
}

export class WalletSecurity {
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly SALT_LENGTH = 32;
  private static readonly ITERATIONS = 100000;

  /**
   * Encrypt a wallet's private key with password
   */
  static encryptWallet(keypair: Keypair, password: string): EncryptedWallet {
    const salt = crypto.randomBytes(this.SALT_LENGTH);
    const iv = crypto.randomBytes(this.IV_LENGTH);
    
    // Derive key from password using PBKDF2
    const key = crypto.pbkdf2Sync(password, salt, this.ITERATIONS, this.KEY_LENGTH, 'sha512');
    
    // Encrypt the private key
    const cipher = crypto.createCipher(this.ALGORITHM, key);
    
    const secretKeyBuffer = Buffer.from(keypair.secretKey);
    let encrypted = cipher.update(secretKeyBuffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return {
      encryptedKey: encrypted.toString('base64'),
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      algorithm: this.ALGORITHM,
      iterations: this.ITERATIONS
    };
  }

  /**
   * Decrypt a wallet's private key with password
   */
  static decryptWallet(encryptedWallet: EncryptedWallet, password: string): Keypair {
    const salt = Buffer.from(encryptedWallet.salt, 'base64');
    const iv = Buffer.from(encryptedWallet.iv, 'base64');
    const encryptedData = Buffer.from(encryptedWallet.encryptedKey, 'base64');
    
    // Derive key from password
    const key = crypto.pbkdf2Sync(password, salt, encryptedWallet.iterations, this.KEY_LENGTH, 'sha512');
    
    // Decrypt
    const decipher = crypto.createDecipher(encryptedWallet.algorithm, key);
    
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return Keypair.fromSecretKey(new Uint8Array(decrypted));
  }

  /**
   * Save encrypted wallet to file
   */
  static saveEncryptedWallet(walletPath: string, encryptedWallet: EncryptedWallet): void {
    fs.writeFileSync(walletPath, JSON.stringify(encryptedWallet, null, 2));
  }

  /**
   * Load encrypted wallet from file
   */
  static loadEncryptedWallet(walletPath: string): EncryptedWallet {
    const data = fs.readFileSync(walletPath, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Prompt for password securely
   */
  static async promptPassword(prompt: string = 'Enter wallet password: '): Promise<string> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      // Hide input
      (rl as any).stdoutMuted = true;
      rl.question(prompt, (password: string) => {
        rl.close();
        console.log(''); // New line after hidden input
        resolve(password);
      });

      (rl as any)._writeToOutput = function(stringToWrite: string) {
        if ((rl as any).stdoutMuted && stringToWrite !== '\n' && stringToWrite !== '\r\n') {
          process.stdout.write('*');
        } else {
          process.stdout.write(stringToWrite);
        }
      };
    });
  }

  /**
   * Convert plain wallet to encrypted wallet
   */
  static async convertPlainWallet(plainWalletPath: string, encryptedWalletPath: string): Promise<void> {
    console.log('🔐 Converting plain wallet to encrypted format...');
    
    // Load plain wallet
    const plainData = fs.readFileSync(plainWalletPath, 'utf8');
    const plainWallet = JSON.parse(plainData);
    
    let keypair: Keypair;
    if (plainWallet.secretKey) {
      keypair = Keypair.fromSecretKey(new Uint8Array(plainWallet.secretKey));
    } else {
      throw new Error('Invalid plain wallet format');
    }
    
    // Get password
    const password = await this.promptPassword('Enter password to encrypt wallet: ');
    const confirmPassword = await this.promptPassword('Confirm password: ');
    
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }
    
    // Encrypt wallet
    const encryptedWallet = this.encryptWallet(keypair, password);
    this.saveEncryptedWallet(encryptedWalletPath, encryptedWallet);
    
    console.log(`✅ Wallet encrypted and saved to ${encryptedWalletPath}`);
    console.log('⚠️  Please delete the plain wallet file for security');
  }

  /**
   * Load wallet with password prompt
   */
  static async loadWalletSecurely(walletPath: string): Promise<Keypair> {
    if (!fs.existsSync(walletPath)) {
      throw new Error(`Wallet file not found: ${walletPath}`);
    }

    try {
      const encryptedWallet = this.loadEncryptedWallet(walletPath);
      const password = await this.promptPassword();
      return this.decryptWallet(encryptedWallet, password);
    } catch (error) {
      // Fallback to plain wallet for backward compatibility
      console.log('⚠️  Loading plain wallet (consider converting to encrypted format)');
      const plainData = fs.readFileSync(walletPath, 'utf8');
      const plainWallet = JSON.parse(plainData);
      
      if (plainWallet.secretKey) {
        return Keypair.fromSecretKey(new Uint8Array(plainWallet.secretKey));
      } else {
        throw new Error('Invalid wallet format');
      }
    }
  }
}