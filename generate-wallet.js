const { Keypair } = require('@solana/web3.js');
const fs = require('fs');

const keypair = Keypair.generate();
const wallet = {
  publicKey: keypair.publicKey.toBase58(),
  secretKey: Array.from(keypair.secretKey),
};

fs.writeFileSync('my-wallet.json', JSON.stringify(wallet));
console.log('Wallet generated and saved to my-wallet.json');
console.log('Public Key:', wallet.publicKey);