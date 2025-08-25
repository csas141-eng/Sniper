import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { LetsBonkSDK } from '../letsbonk-sdk';
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

export interface BonkTokenLaunch {
  mint: string;
  name?: string;
  symbol?: string;
  description?: string;
  launchTime?: number;
  initialLiquidity?: number;
  creator?: string;
  holders?: number;
  liquidity?: number;
  // add more as referenced in code
}

export class BonkFunIntegration {
  private connection: Connection;
  private isInitialized: boolean = false;
  private letsBonkSDK: LetsBonkSDK | null = null;

  constructor(connection: Connection) {
    this.connection = connection;
    this.initializeSDK();
  }

  private async initializeSDK(): Promise<void> {
    try {
      // Create a temporary wallet for SDK initialization
      const tempWallet = Keypair.generate();
      this.letsBonkSDK = new LetsBonkSDK(this.connection, tempWallet);
      
      this.isInitialized = true;
      console.log('✅ Bonk.fun integration with LetsBonkSDK initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Bonk.fun integration:', error);
    }
  }

  // Monitor for new token launches on Bonk.fun
  async monitorNewLaunches(): Promise<BonkTokenLaunch[]> {
    if (!this.isInitialized) {
      console.log('⚠️ Bonk.fun integration not initialized');
      return [];
    }

    try {
      // Get recent token launches from Bonk.fun API
      const launches = await this.getRecentLaunches();
      
      // Filter for new launches (within last 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      // Patch for: 'launch.launchTime' is possibly 'undefined'
      const newLaunches = launches.filter(launch => (launch.launchTime ?? 0) > fiveMinutesAgo);
      
      if (newLaunches.length > 0) {
        console.log(`🎯 Found ${newLaunches.length} new Bonk.fun launches`);
        await this.notifyNewLaunches(newLaunches);
      }
      
      return newLaunches;
    } catch (error) {
      console.error('Error monitoring Bonk.fun launches:', error);
      return [];
    }
  }

  // Get recent token launches from Bonk.fun API
  private async getRecentLaunches(): Promise<BonkTokenLaunch[]> {
    try {
      // Use Bonk.fun API to get real launches
      const response = await fetch('https://api.bonk.fun/launches/recent');
      if (!response.ok) {
        throw new Error(`Bonk.fun API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.launches || [];
    } catch (error) {
      console.error('Error getting recent launches:', error);
      return [];
    }
  }

  // Execute buy on new token launch
  async buyNewToken(launch: BonkTokenLaunch, wallet: Keypair, amount: number): Promise<{ success: boolean; signature?: string; error?: string }> {
    if (!this.isInitialized || !this.letsBonkSDK) {
      return { success: false, error: 'Bonk.fun integration not initialized' };
    }

    try {
      console.log(`🚀 Buying ${launch.symbol} (${launch.mint}) on Bonk.fun using real SDK`);
      
      // Convert SOL amount to lamports
      const buyAmountLamports = BigInt(Math.floor(amount * 1e9));
      const mintPubkey = new PublicKey(launch.mint);
      
      // Use the actual LetsBonkSDK for real trading
      const result = await this.letsBonkSDK.buy(
        wallet,
        mintPubkey,
        buyAmountLamports,
        BigInt(0) // minimum out - could be calculated based on slippage
      );
      
      if (result.success && result.data?.signature) {
        console.log(`✅ Successfully bought ${launch.symbol} for ${amount} SOL, signature: ${result.data.signature}`);
        return {
          success: true,
          signature: result.data.signature
        };
      } else {
        return {
          success: false,
          error: 'Buy operation failed through SDK'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to buy ${launch.symbol}:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Get token information
  async getTokenInfo(mint: string): Promise<any> {
    if (!this.isInitialized) {
      return null;
    }

    try {
      // Use Bonk.fun API to get token info
      const response = await fetch(`https://api.bonk.fun/token/${mint}`);
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting token info:', error);
      return null;
    }
  }

  // Check if token is on Bonk.fun
  async isTokenOnBonkFun(mint: string): Promise<boolean> {
    try {
      const tokenInfo = await this.getTokenInfo(mint);
      return tokenInfo !== null;
    } catch (error) {
      return false;
    }
  }

  // Notify about new launches
  private async notifyNewLaunches(launches: BonkTokenLaunch[]): Promise<void> {
    for (const launch of launches) {
      // Notify about new launch - temporarily disabled due to service dependencies
      console.log(`💰 New launch notification temporarily disabled - implement with proper service dependencies`);
    }
  }
}

// Service instance will be created by SniperBot
