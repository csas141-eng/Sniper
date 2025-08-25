"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletSecurity = void 0;
const web3_js_1 = require("@solana/web3.js");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const readline = __importStar(require("readline"));
class WalletSecurity {
    static ALGORITHM = 'aes-256-cbc';
    static KEY_LENGTH = 32;
    static IV_LENGTH = 16;
    static SALT_LENGTH = 32;
    static ITERATIONS = 100000;
    /**
     * Encrypt a wallet's private key with password
     */
    static encryptWallet(keypair, password) {
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
    static decryptWallet(encryptedWallet, password) {
        const salt = Buffer.from(encryptedWallet.salt, 'base64');
        const iv = Buffer.from(encryptedWallet.iv, 'base64');
        const encryptedData = Buffer.from(encryptedWallet.encryptedKey, 'base64');
        // Derive key from password
        const key = crypto.pbkdf2Sync(password, salt, encryptedWallet.iterations, this.KEY_LENGTH, 'sha512');
        // Decrypt
        const decipher = crypto.createDecipher(encryptedWallet.algorithm, key);
        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return web3_js_1.Keypair.fromSecretKey(new Uint8Array(decrypted));
    }
    /**
     * Save encrypted wallet to file
     */
    static saveEncryptedWallet(walletPath, encryptedWallet) {
        fs.writeFileSync(walletPath, JSON.stringify(encryptedWallet, null, 2));
    }
    /**
     * Load encrypted wallet from file
     */
    static loadEncryptedWallet(walletPath) {
        const data = fs.readFileSync(walletPath, 'utf8');
        return JSON.parse(data);
    }
    /**
     * Prompt for password securely
     */
    static async promptPassword(prompt = 'Enter wallet password: ') {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            // Hide input
            rl.stdoutMuted = true;
            rl.question(prompt, (password) => {
                rl.close();
                console.log(''); // New line after hidden input
                resolve(password);
            });
            rl._writeToOutput = function (stringToWrite) {
                if (rl.stdoutMuted && stringToWrite !== '\n' && stringToWrite !== '\r\n') {
                    process.stdout.write('*');
                }
                else {
                    process.stdout.write(stringToWrite);
                }
            };
        });
    }
    /**
     * Convert plain wallet to encrypted wallet
     */
    static async convertPlainWallet(plainWalletPath, encryptedWalletPath) {
        console.log('🔐 Converting plain wallet to encrypted format...');
        // Load plain wallet
        const plainData = fs.readFileSync(plainWalletPath, 'utf8');
        const plainWallet = JSON.parse(plainData);
        let keypair;
        if (plainWallet.secretKey) {
            keypair = web3_js_1.Keypair.fromSecretKey(new Uint8Array(plainWallet.secretKey));
        }
        else {
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
    static async loadWalletSecurely(walletPath) {
        if (!fs.existsSync(walletPath)) {
            throw new Error(`Wallet file not found: ${walletPath}`);
        }
        try {
            const encryptedWallet = this.loadEncryptedWallet(walletPath);
            const password = await this.promptPassword();
            return this.decryptWallet(encryptedWallet, password);
        }
        catch (error) {
            // Fallback to plain wallet for backward compatibility
            console.log('⚠️  Loading plain wallet (consider converting to encrypted format)');
            const plainData = fs.readFileSync(walletPath, 'utf8');
            const plainWallet = JSON.parse(plainData);
            if (plainWallet.secretKey) {
                return web3_js_1.Keypair.fromSecretKey(new Uint8Array(plainWallet.secretKey));
            }
            else {
                throw new Error('Invalid wallet format');
            }
        }
    }
}
exports.WalletSecurity = WalletSecurity;
