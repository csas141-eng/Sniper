#!/usr/bin/env node

const { Keypair } = require('@solana/web3.js');
const { WalletSecurity } = require('./dist/services/wallet-security');
const fs = require('fs');
const readline = require('readline');

/**
 * Wallet conversion utility - converts plain wallets to encrypted format
 */

console.log('🔐 Solana Wallet Security Converter\n');

async function main() {
  const args = process.argv.slice(2);
  
  // Check if we should generate a new encrypted wallet
  if (args.includes('--generate') || args.includes('-g')) {
    await generateNewEncryptedWallet();
    return;
  }
  
  // Check for existing wallets to convert
  const plainWalletPath = './my-wallet.json';
  const encryptedWalletPath = './my-wallet.encrypted.json';
  
  if (fs.existsSync(encryptedWalletPath)) {
    console.log('✅ Encrypted wallet already exists at:', encryptedWalletPath);
    console.log('💡 To generate a new wallet, use: node convert-wallet.js --generate');
    return;
  }
  
  if (fs.existsSync(plainWalletPath)) {
    console.log('⚠️  Plain wallet found. Converting to encrypted format...\n');
    await convertExistingWallet(plainWalletPath, encryptedWalletPath);
  } else {
    console.log('ℹ️  No existing wallet found.');
    const shouldGenerate = await askQuestion('Would you like to generate a new encrypted wallet? (yes/no): ');
    
    if (shouldGenerate.toLowerCase() === 'yes' || shouldGenerate.toLowerCase() === 'y') {
      await generateNewEncryptedWallet();
    } else {
      console.log('👋 Goodbye! Run this script again when you\'re ready.');
    }
  }
}

async function generateNewEncryptedWallet() {
  console.log('🔑 Generating new encrypted wallet...\n');
  
  // Generate new keypair
  const keypair = Keypair.generate();
  console.log('✅ New keypair generated');
  console.log('Public Key:', keypair.publicKey.toBase58());
  
  // Get password from user
  console.log('\n🔒 Please set a password for your wallet:');
  const password = await getPassword('Enter password: ');
  const confirmPassword = await getPassword('Confirm password: ');
  
  if (password !== confirmPassword) {
    console.error('❌ Passwords do not match!');
    process.exit(1);
  }
  
  if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters long!');
    process.exit(1);
  }
  
  try {
    // Encrypt and save wallet
    const encryptedWallet = WalletSecurity.encryptWallet(keypair, password);
    WalletSecurity.saveEncryptedWallet('./my-wallet.encrypted.json', encryptedWallet);
    
    console.log('\n✅ Encrypted wallet saved to: ./my-wallet.encrypted.json');
    console.log('🔑 Public Key:', keypair.publicKey.toBase58());
    
    console.log('\n🚨 IMPORTANT SECURITY REMINDERS:');
    console.log('   1. Keep your password secure and backed up');
    console.log('   2. Never share your wallet file or password');
    console.log('   3. This wallet has no SOL - you need to fund it');
    console.log('   4. Use a dedicated trading wallet with limited funds');
    
    console.log('\n💡 To fund your wallet, send SOL to:', keypair.publicKey.toBase58());
    
  } catch (error) {
    console.error('❌ Error generating encrypted wallet:', error.message);
    process.exit(1);
  }
}

async function convertExistingWallet(plainPath, encryptedPath) {
  try {
    // Load and validate existing wallet
    const walletData = fs.readFileSync(plainPath, 'utf8');
    const wallet = JSON.parse(walletData);
    
    if (!wallet.secretKey) {
      console.error('❌ Invalid wallet format - missing secretKey');
      process.exit(1);
    }
    
    const keypair = Keypair.fromSecretKey(new Uint8Array(wallet.secretKey));
    console.log('✅ Existing wallet loaded');
    console.log('Public Key:', keypair.publicKey.toBase58());
    
    // Get password from user
    console.log('\n🔒 Please set a password for encryption:');
    const password = await getPassword('Enter password: ');
    const confirmPassword = await getPassword('Confirm password: ');
    
    if (password !== confirmPassword) {
      console.error('❌ Passwords do not match!');
      process.exit(1);
    }
    
    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters long!');
      process.exit(1);
    }
    
    // Encrypt and save wallet
    const encryptedWallet = WalletSecurity.encryptWallet(keypair, password);
    WalletSecurity.saveEncryptedWallet(encryptedPath, encryptedWallet);
    
    console.log('\n✅ Wallet converted successfully!');
    console.log('✅ Encrypted wallet saved to:', encryptedPath);
    
    // Ask about deleting plain wallet
    const shouldDelete = await askQuestion('\n🗑️  Delete the plain wallet file for security? (recommended - yes/no): ');
    
    if (shouldDelete.toLowerCase() === 'yes' || shouldDelete.toLowerCase() === 'y') {
      fs.unlinkSync(plainPath);
      console.log('✅ Plain wallet file deleted');
    } else {
      console.log('⚠️  Plain wallet file kept - remember to delete it manually for security');
    }
    
    console.log('\n🚨 IMPORTANT:');
    console.log('   - Your wallet is now encrypted and requires a password');
    console.log('   - Keep your password secure and backed up');
    console.log('   - The bot will prompt for the password when starting');
    
  } catch (error) {
    console.error('❌ Error converting wallet:', error.message);
    process.exit(1);
  }
}

function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function getPassword(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.stdoutMuted = true;
    rl.question(prompt, (password) => {
      rl.close();
      console.log(''); // New line after hidden input
      resolve(password);
    });

    rl._writeToOutput = function(stringToWrite) {
      if (rl.stdoutMuted && stringToWrite !== '\n' && stringToWrite !== '\r\n') {
        rl.output.write('*');
      } else {
        rl.output.write(stringToWrite);
      }
    };
  });
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}