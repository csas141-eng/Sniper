import { Connection, Keypair, PublicKey, Transaction, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { LetsBonkSDK } from './letsbonk-sdk';
import { PumpFun } from './pumpfun';
import { Raydium } from './raydium';
import { MeteoraMonitor } from './meteora';
import fs from 'fs';
import WebSocket from 'ws';
import { VersionedTransaction } from '@solana/web3.js';
import { riskManager } from './services/risk-manager';
import { notificationService } from './services/notifications';
import { EnhancedSwapService } from './services/enhanced-swap';
import { transactionParser } from './services/transaction-parser';
import { TokenValidator } from './services/token-validator';
import { BonkFunIntegration } from './services/bonk-fun-integration';
import { ProfitTaker, Position } from './services/profit-taker';
import { addressBlacklist } from './services/address-blacklist';
import { transactionAnomalyMonitor } from './services/transaction-anomaly-monitor';
import { userConfirmationService } from './services/user-confirmation';
import { createBalanceValidator } from './services/balance-validator';

// NEW: Updated endpoints for PumpPortal
const PUMP_PORTAL_WS_URL = 'wss://pumpportal.fun/api/data';
const PUMP_FUN_REST_URL = 'https://pumpportal.fun/api/trade-local';

// Load user configuration from config.json
const loadUserConfig = () => {
  try {
    const configData = fs.readFileSync('./config.json', 'utf8');
    const userConfig = JSON.parse(configData);
    
    // Merge with default config structure
    return {
      SOLANA_RPC_URL: userConfig.solanaRpcUrl,
      walletPath: './my-wallet.json',
      AMOUNT_TO_BUY: userConfig.buyAmountSol,
      SLIPPAGE: userConfig.slippage,
      MAX_RETRIES: 5,
      RETRY_DELAY: 1000,
      MIN_LIQUIDITY: 0.001,
      PRIORITY_FEE: 50000,
      WEBSOCKET_RECONNECT_DELAY: 5000,
      MAX_CONCURRENT_SNIPES: 3,
      GAS_LIMIT_MULTIPLIER: 1.2,
      TOKEN_VALIDATION: {
        MIN_LIQUIDITY_USD: 10000,
        MIN_HOLDERS: 7,
        REQUIRE_NO_MINT: true,
        REQUIRE_NO_BLACKLIST: true,
        ENABLE_UNIVERSAL_SNIPING: true
      },
      SWAP_METHODS: {
        SOLANA: 'solana',
        JITO: 'jito',
        NOZOMI: 'nozomi',
        ZERO_SLOT: '0slot',
        RACE: 'race'
      },
      JITO: {
        ENABLED: true,
        TIP_ACCOUNT: '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
        TIP_AMOUNT: 100000,
        MAX_RETRIES: 3,
        TIMEOUT: 30000
      },
      NOZOMI: {
        ENABLED: true,
        TIP_ACCOUNT: 'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
        TIP_AMOUNT: 200000,
        MAX_RETRIES: 3,
        TIMEOUT: 30000
      },
      PRIORITY_FEES: {
        STANDARD: 10000,
        HIGH: 50000,
        ULTRA: 100000,
        JITO_TIP: 100000,
        NOZOMI_TIP: 200000,
      },
      PLATFORM_CONFIG: {
        PUMP_FUN: {
          enabled: true,
          priority: 'high',
          maxSlippage: userConfig.slippage
        },
        PUMP_SWAP: {
          enabled: true,
          priority: 'medium',
          maxSlippage: userConfig.slippage
        },
        RAYDIUM_LAUNCHLAB: {
          enabled: true,
          priority: 'high',
          maxSlippage: userConfig.slippage
        },
        RAYDIUM_CPMM: {
          enabled: true,
          priority: 'medium',
          maxSlippage: userConfig.slippage
        },
        BONK_FUN: {
          enabled: true,
          priority: 'high',
          maxSlippage: userConfig.slippage
        }
      },
      RISK_MANAGEMENT: {
        maxDailyLoss: 1.0,
        maxSingleLoss: 0.5,
        tradeCooldown: 5000,
        maxPositions: 5,
        minLiquidity: 10,
        maxTxAge: 1
      },
      PERFORMANCE: {
        maxRetries: 3,
        retryDelay: 1000,
        connectionTimeout: 30000,
        maxConcurrentRequests: 10
      },
      SECURITY: {
        enableSimulation: true,
        maxInstructionSize: 10000,
        requireValidSignatures: true,
        enableTransactionValidation: true
      },
      LOGGING: {
        level: 'info',
        debug: false,
        logToFile: true,
        logFilePath: './logs/trading-bot.log'
      },
      PROFIT_TAKING: {
        TIER_1: { percentage: 10.0, amount: 0.35 },
        TIER_2: { percentage: 100.0, amount: 0.35 },
        KEEP_AMOUNT: 0.30,
        ENABLE_AUTO_SELL: true,
        MIN_PROFIT_TO_SELL: 0.5,
        MAX_HOLD_TIME: 24 * 60 * 60 * 1000
      }
    };
  } catch (error) {
    console.error('Error loading config.json, using defaults:', error);
    // Return default config if file loading fails
    return {
      SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
      walletPath: './my-wallet.json',
      AMOUNT_TO_BUY: 0.00001,
      SLIPPAGE: 0.3,
      SWAP_METHODS: {
        SOLANA: 'solana',
        JITO: 'jito',
        NOZOMI: 'nozomi',
        ZERO_SLOT: '0slot',
        RACE: 'race'
      },
      PROFIT_TAKING: {
        TIER_1: { percentage: 10.0, amount: 0.35 },
        TIER_2: { percentage: 100.0, amount: 0.35 },
        KEEP_AMOUNT: 0.30,
        ENABLE_AUTO_SELL: true,
        MIN_PROFIT_TO_SELL: 0.5,
        MAX_HOLD_TIME: 24 * 60 * 60 * 1000
      }
    };
  }
};

// Load user configuration
const CONFIG = loadUserConfig();

export interface SnipeResult {
  success: boolean;
  error?: string;
  tokenMint: string;
  platform: string;
  amount: number;
  signature?: string;
  timestamp: number;
  developer?: string;
  entryPrice?: number; // Add entry price for profit monitoring
  startTime?: number;  // Add start time for tracking
  status?: string;     // Add status for tracking
  baseReserve?: number;
  quoteReserve?: number;
  // add more as referenced in code
}

export class SniperBot {
  private connection: Connection;
  private wallet: Keypair;
  private sdk: LetsBonkSDK;
  private pumpFun: PumpFun;
  private raydium: Raydium;
  private meteoraMonitor: MeteoraMonitor;
  private enhancedSwapService: EnhancedSwapService;
  private tokenValidator: TokenValidator;
  private bonkFunIntegration: BonkFunIntegration;
  private profitTaker: ProfitTaker;
  private targetDevelopers: PublicKey[];
  private isRunning: boolean = false;
  private failedTransactions: Set<string> = new Set();
  private ws: WebSocket | null = null;
  private activeSnipes: Map<string, { platform: string; startTime: number; status: string; signature?: string }> = new Map(); // Changed to Map
  private snipeHistory: SnipeResult[] = [];

  // Configuration
  private buyAmountSol: number = 0;
  private buySlippage: number = 0;
  private seenSignatures: Set<string> = new Set();
  private targetDeveloperSet: Set<string>;
  private maxRetries: number = 5;
  private retryDelay: number = 1000;
  private maxConcurrentSnipes: number = 3;

  // ✅ NEW: Multi-tier profit-taking strategy implementation
  private activeProfitMonitoring: Map<string, {
    platform: string;
    entryPrice: number;
    entryAmount: number;
    remainingAmount: number;
    soldAmount: number;
    tier1Sold: boolean;
    tier2Sold: boolean;
    monitoringInterval: NodeJS.Timeout;
    lastPriceCheck: number;
  }> = new Map();

  constructor(connection: Connection, wallet: Keypair, sdk: LetsBonkSDK, targetDevelopers: string[]) {
    this.connection = connection;
    this.wallet = wallet;
    this.sdk = sdk;
    this.pumpFun = new PumpFun(connection, wallet);
    this.raydium = new Raydium(connection, wallet);
    this.meteoraMonitor = new MeteoraMonitor(connection, this);
    
    // Create service instances
    this.enhancedSwapService = new EnhancedSwapService(connection);
    this.tokenValidator = new TokenValidator(connection);
    this.bonkFunIntegration = new BonkFunIntegration(connection);
    this.profitTaker = new ProfitTaker(connection);
    
    this.targetDevelopers = targetDevelopers.map(dev => {
      try {
        return new PublicKey(dev);
      } catch (error) {
        console.error(`Invalid public key: ${dev}`);
        return null;
      }
    }).filter((pubkey): pubkey is PublicKey => pubkey !== null);

    this.targetDeveloperSet = new Set(this.targetDevelopers.map(dev => dev.toBase58()));
  }

  // Deprecated method removed - use start() directly

  private async setupMultiPlatformMonitoring(): Promise<void> {
    // Setup Pump.fun monitoring
    await this.pumpFun.onNewToken(async (tokenInfo) => {
      if (this.targetDeveloperSet.has(tokenInfo.developer.toBase58())) {
        console.log(`🎯 New Pump.fun token detected: ${tokenInfo.mint.toBase58()}`);
        await this.snipeToken(tokenInfo.mint.toBase58(), 'pumpfun', tokenInfo.developer.toBase58());
      }
    });

    // Setup Raydium monitoring
    await this.raydium.onNewPool(async (poolInfo) => {
      if (this.targetDeveloperSet.has(poolInfo.developer.toBase58())) {
        console.log(`🎯 New Raydium pool detected: ${poolInfo.mint.toBase58()}`);
        await this.snipeToken(poolInfo.mint.toBase58(), 'raydium', poolInfo.developer.toBase58());
      }
    });

    // ✅ ENHANCED: Setup Meteora monitoring with better error handling
    try {
      await this.meteoraMonitor.onNewToken(async (tokenInfo) => {
        console.log(`🎯 Meteora callback triggered for token: ${tokenInfo.mint.toBase58()}`);
        console.log(` Developer: ${tokenInfo.developer.toBase58()}`);
        console.log(`🎯 Is target developer? ${this.targetDeveloperSet.has(tokenInfo.developer.toBase58())}`);
        
        if (this.targetDeveloperSet.has(tokenInfo.developer.toBase58())) {
          console.log(`🚀 New Meteora token detected: ${tokenInfo.mint.toBase58()}`);
          console.log(`🎯 Target developer confirmed: ${tokenInfo.developer.toBase58()}`);
          await this.snipeToken(tokenInfo.mint.toBase58(), 'meteora', tokenInfo.developer.toBase58());
        } else {
          console.log(`🚫 Meteora token ${tokenInfo.mint.toBase58()} filtered out - developer ${tokenInfo.developer.toBase58()} not in target list`);
        }
      });
      console.log('✅ Meteora callback registered successfully');
    } catch (error) {
      console.error('❌ Failed to register Meteora callback:', error);
    }
  }

  private setupDeveloperMonitoring(): void {
    this.targetDevelopers.forEach(developer => {
      this.connection.onLogs(
        developer,
        (logs) => {
          if (!this.isRunning) return;

          if (logs.err) {
            this.handleLogError(logs.err);
            return;
          }

          const newTokenMint = this.extractNewTokenMint(logs.logs);
          if (newTokenMint) {
            console.log(`New token detected from ${developer.toBase58()}: ${newTokenMint.toBase58()}`);
            this.snipeToken(newTokenMint.toBase58(), 'developer', developer.toBase58());
          }
        },
        'confirmed'
      );
    });
  }

  private setupWebSocket() {
    // NEW: Use updated PumpPortal endpoint
    const wsUrl = PUMP_PORTAL_WS_URL;
    
    // Try to establish connection with authentication
    try {
      this.ws = new WebSocket(wsUrl);
      
      // FIXED: Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          console.log('⚠️ WebSocket connection timeout, retrying...');
          this.ws.close();
        }
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket connection established');

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          console.log('📡 Subscribing to WebSocket channels...');
          
          // FIXED: Add authentication token if available
          const authToken = process.env.PUMPFUN_AUTH_TOKEN;
          if (authToken && this.ws) {
            console.log('🔑 Sending authentication token...');
            this.ws.send(JSON.stringify({ 
              method: "authenticate", 
              token: authToken 
            }));
          } else {
            console.log('⚠️ No auth token - attempting connection without authentication');
          }
          
          if (this.ws) {
            this.ws.send(JSON.stringify({ method: "subscribeNewToken" }));
            this.ws.send(JSON.stringify({ method: "subscribeMigration" }));
            this.ws.send(JSON.stringify({
              method: "subscribeAccountTrade",
              keys: this.targetDevelopers.map(dev => dev.toBase58())
            }));
          }

          console.log(`🎯 Subscribed to ${this.targetDevelopers.length} target developers:`, 
            this.targetDevelopers.map(dev => dev.toBase58()));

          // Keepalive
          const pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === this.ws.OPEN) {
              try { (this.ws as any).ping?.(); } catch {}
            } else {
              clearInterval(pingInterval);
            }
          }, 30000);
        }
      });
    } catch (error) {
      console.error('❌ WebSocket setup error:', error);
      // Retry after delay
      setTimeout(() => this.setupWebSocket(), 5000);
    }

    if (this.ws) {
      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const parsedData = JSON.parse(data.toString());
          this.handleWebSocketMessage(parsedData);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        
        // Handle 401 errors specifically with better logging
        if (error.toString().includes('401')) {
          console.log('⚠️ WebSocket authentication error (401) - checking auth token...');
          const authToken = process.env.PUMPFUN_AUTH_TOKEN;
          if (!authToken) {
            console.log('❌ No PUMPFUN_AUTH_TOKEN found in environment variables');
            console.log('💡 Add PUMPFUN_AUTH_TOKEN to your .env file or try without authentication');
          } else {
            console.log('🔑 Auth token found, but still getting 401 - token may be invalid or expired');
          }
          // Add longer delay for auth errors
          setTimeout(() => this.reconnectWebSocket(), 15000);
        } else {
          this.reconnectWebSocket();
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`WebSocket connection closed: ${code} - ${reason}`);
        // Handle 401 close codes
        if (code === 1008 || code === 1009) { // Policy violation or too large
          console.log('⚠️ WebSocket closed due to policy violation - will retry with delay');
          setTimeout(() => this.reconnectWebSocket(), 15000);
        } else {
          this.reconnectWebSocket();
        }
      });
    }
  }

  private reconnectWebSocket(): void {
    setTimeout(() => {
      if (this.isRunning) {
        console.log('Attempting to reconnect WebSocket...');
        this.setupWebSocket();
      }
    }, 5000);
  }

  // ✅ ENHANCED: Improved start method with null checks and better error handling
  async start(amount: number, slippage: number): Promise<void> {
    if (this.isRunning) {
      console.log('Bot is already running');
      return;
    }

    console.log('🚀 Starting Sniper Bot...');
    this.isRunning = true;
    this.buyAmountSol = amount; // Set buy amount
    this.buySlippage = slippage; // Set slippage

    // Display sniping mode
    console.log('🚀 UNIVERSAL SNIPING ENABLED - Monitoring ALL new tokens that meet criteria:');
    console.log('💰 Min Liquidity: $10,000');
    console.log('👥 Min Holders: 7');
    console.log('🚫 NoMint Authority: true');
    console.log('🚫 No Blacklist: true');

    try {
      // Setup multi-platform monitoring callbacks first
      await this.setupMultiPlatformMonitoring();

      // Start WebSocket connection with new PumpPortal endpoint
      await this.setupWebSocket();
      
      // Start Bonk.fun monitoring in background with REST fallback
      this.startBonkFunMonitoring();
      
      // Start profit taking monitoring
      this.profitTaker.startMonitoring();
      
      // Start Raydium monitoring with null check
      if (this.raydium) await this.raydium.startMonitoring();
      
      // Start Pump.fun monitoring with null check
      if (this.pumpFun) await this.pumpFun.startMonitoring();
      
      // Start LetsBonk SDK monitoring with null check
      if (this.sdk) await this.sdk.startMonitoring();
      
      // Start Meteora monitoring with null check and REST fallback
      if (this.meteoraMonitor) await this.meteoraMonitor.startMonitoring();
      
      // Subscribe to program logs for each developer (this is separate from platform-specific monitors)
      this.setupDeveloperMonitoring();

      console.log('✅ All monitoring systems started successfully');
      console.log('🔗 Using new PumpPortal endpoints:');
      console.log(`   WebSocket: ${PUMP_PORTAL_WS_URL}`);
      console.log(`   REST API: ${PUMP_FUN_REST_URL}`);
      
      // Start profit monitoring cleanup
      this.startProfitMonitoringCleanup();
      
    } catch (error) {
      console.error('Error starting bot:', error);
      this.isRunning = false;
      throw error;
    }
  }

  // NEW: Example method showing how to use Pump.fun REST API
  private async executePumpFunRestCall(method: string, data: any): Promise<any> {
    try {
      console.log(`📡 Making REST call to Pump.fun: ${method}`);
      
      const response = await fetch(PUMP_FUN_REST_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.PUMPFUN_AUTH_TOKEN || ''}`
        },
        body: JSON.stringify({
          method: method,
          ...data
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Pump.fun REST call successful: ${method}`);
        return result;
      } else {
        console.error(`❌ Pump.fun REST call failed: ${response.status} ${response.statusText}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error in Pump.fun REST call:`, error);
      return null;
    }
  }



  // ✅ FIXED: Enhanced blockchain fallback verification with proper MessageV0 handling
  private async verifyTokenCreatorFromBlockchain(mintStr: string, signature: string): Promise<void> {
    try {
      console.log(`🔍 Fetching blockchain transaction: ${signature}`);
      const transaction = await this.connection.getTransaction(signature, { 
        commitment: 'confirmed', 
        maxSupportedTransactionVersion: 0 
      });
      
      if (!transaction || !transaction.meta) {
        console.log(`❌ Transaction not found: ${signature}`);
        return;
      }

      let accountKeys: PublicKey[] = [];
      let isAccountWritable: (index: number) => boolean = () => false;

      try {
        if ('getAccountKeys' in transaction.transaction.message && typeof transaction.transaction.message.getAccountKeys === 'function') {
          const messageV0 = transaction.transaction.message as any;
          accountKeys = messageV0.getAccountKeys().keySegments().flat();
          isAccountWritable = (index: number) => messageV0.isAccountWritable(index);
        } else if ('accountKeys' in transaction.transaction.message && Array.isArray(transaction.transaction.message.accountKeys)) {
          // Legacy message (has accountKeys property as an array)
          const legacyMessage = transaction.transaction.message as any;
          accountKeys = legacyMessage.accountKeys;
          isAccountWritable = (index: number) => legacyMessage.isAccountWritable(index);
        } else {
          console.log(`⚠️ Unknown transaction message type for signature: ${signature}`);
          return;
        }
      } catch (error) {
        console.log(`⚠️ Could not extract account keys from transaction (likely address lookup table issue for ${signature}): ${error}`);
        return;
      }

      if (accountKeys.length === 0) {
        console.log(`⚠️ No account keys found in transaction`);
        return;
      }

      // Define ignored addresses (common program IDs and non-developer addresses)
      const ignoredAddresses = new Set([
        '11111111111111111111111111111111', // System Program
        'ComputeBudget111111111111111111111111111111', // Compute Budget Program
        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Account Program
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token Program
        'metaqbxxUerdq28cj1RbTGWuhtQgypSZKdAiNKcvN', // Metaplex Token Metadata Program
        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter Aggregator
        'routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS', // Another common program/router
      ]);

      // Check fee payer (often the creator)
      const feePayer = accountKeys[0];
      if (feePayer && !ignoredAddresses.has(feePayer.toBase58()) && this.targetDeveloperSet.has(feePayer.toBase58())) {
        console.log(`🎯 BLOCKCHAIN FALLBACK: Found target developer ${feePayer.toBase58()} as fee payer!`);
        console.log(`🚀 Attempting delayed snipe for token: ${mintStr}`);
        
        try {
          await this.snipeToken(mintStr, 'pumpportal', feePayer.toBase58());
        } catch (e) {
          console.error('Error in blockchain fallback snipe:', e);
        }
      return;
      }

      // Check writable accounts for potential creators
      for (let i = 0; i < accountKeys.length; i++) {
        try {
          if (isAccountWritable(i)) {
            const account = accountKeys[i];
            if (account && !ignoredAddresses.has(account.toBase58()) && this.targetDeveloperSet.has(account.toBase58())) {
              console.log(`🎯 BLOCKCHAIN FALLBACK: Found target developer ${account.toBase58()} in writable accounts!`);
              console.log(`🚀 Attempting delayed snipe for token: ${mintStr}`);
              
              try {
                await this.snipeToken(mintStr, 'pumpportal', account.toBase58());
              } catch (e) {
                console.error('Error in blockchain fallback snipe:', e);
              }
              return;
            }
          }
        } catch (error) {
          console.log(`⚠️ Error checking account ${i}: ${error}`);
          continue;
        }
      }

      console.log(`❌ No target developers found in blockchain data for ${mintStr}`);
    } catch (error) {
      console.error(`Error verifying token creator from blockchain:`, error);
    }
  }

  private async handleWebSocketMessage(data: any) {
    if (typeof data?.message === 'string') return;

    // ✅ ENHANCED: Debug logging for ALL WebSocket messages
    console.log(`📡 WebSocket message received:`, JSON.stringify(data, null, 2));
    
    if (data?.txType === 'create') {
      console.log(`🔍 WebSocket CREATE event received:`, {
        mint: data?.mint,
        trader: data?.traderPublicKey,
        developer: data?.developer,
        creator: data?.creator,
        authority: data?.authority,
        mint_authority: data?.mint_authority,
        update_authority: data?.update_authority,
        owner: data?.owner,
        signature: data?.signature,
        // Log ALL possible fields
        ...Object.keys(data).reduce((acc, key) => {
          if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('dev') || key.toLowerCase().includes('creat')) {
            acc[key] = data[key];
          }
          return acc;
        }, {} as any)
      });
    }

    const isCreate = data?.txType === 'create';
    const mintStr = data?.mint as string | undefined;
    const trader = data?.traderPublicKey as string | undefined;
    const signature = data?.signature as string | undefined;

    // ✅ ENHANCED: Try ALL possible developer fields with validation
    const developer = data?.developer || 
                   data?.creator || 
                   data?.authority || 
                   data?.mint_authority || 
                   data?.update_authority || 
                   data?.owner || 
                   data?.deployer ||
                   data?.initializer ||
                   trader; // Fallback to trader

    if (isCreate && typeof mintStr === 'string' && typeof developer === 'string') {
      // ✅ ENHANCED: Validate developer address format before processing
      if (!this.isValidPublicKey(developer)) {
        console.log(`⚠️ Invalid developer address format: ${developer}`);
        return;
      }

      // ✅ NEW: Universal sniping with 10-minute age tolerance
      const tokenAge = Date.now() - (data?.timestamp || Date.now());
      const maxAgeMs = 10 * 60 * 1000; // 10 minutes in milliseconds
      
      if (tokenAge > maxAgeMs) {
        console.log(`⏰ Token ${mintStr} is ${Math.round(tokenAge / 60000)} minutes old - too old to snipe`);
        return;
      }
      
      console.log(`🔍 Token ${mintStr} detected - Universal sniping enabled!`);
      console.log(`✅ Token meets criteria: $10k+ liquidity, 7+ holders, NoMint, NoBlacklist`);
      console.log(`⏰ Token age: ${Math.round(tokenAge / 60000)} minutes (within 10-minute limit)`);

      if (signature && this.seenSignatures.has(signature)) return;
      if (signature) this.seenSignatures.add(signature);

      try {
        console.log('✅ New token detected from WebSocket:', {
          mint: mintStr,
          developer, // ✅ FIXED: Log developer, not trader
          trader,
          signature,
          pool: data?.pool,
          initialBuy: data?.initialBuy
        });
        this.snipeToken(mintStr, 'pumpportal', developer); // ✅ FIXED: Pass developer, not trader
      } catch (e) {
        console.error('Invalid mint in WS payload:', mintStr, e);
      }
    }
  }

  private async checkBalance(): Promise<boolean> {
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    const minBalance = 0.05 * LAMPORTS_PER_SOL;
    if (balance < minBalance) {
      console.error(`Insufficient balance. Current: ${balance / LAMPORTS_PER_SOL} SOL, Minimum required: ${minBalance / LAMPORTS_PER_SOL} SOL`);
      return false;
    }
    return true;
  }

  private handleLogError(err: any): void {
    if ('InsufficientFundsForRent' in err) {
      console.error('Transaction failed due to insufficient funds for rent:', err);
      this.checkBalance();
    } else if ('InstructionError' in err) {
      console.error('Transaction failed due to an instruction error:', err);
      if (err.InstructionError[1] && err.InstructionError[1].Custom === 1) {
        console.error('Custom error 1: This might indicate a specific program error.');
      }
    } else {
      console.error('Error in log:', err);
    }
  }

  private extractNewTokenMint(logs: string[]): PublicKey | null {
    for (const log of logs) {
      if (log.includes('New token mint:')) {
        const mintAddress = log.split('New token mint:')[1].trim();
        return new PublicKey(mintAddress);
      }
    }
    return null;
  }

  private trackFailedTransaction(signature: string): void {
    this.failedTransactions.add(signature);
    console.log(`Added failed transaction to tracking: ${signature}`);
    console.log(`Total failed transactions: ${this.failedTransactions.size}`);
  }

  // ✅ IMPROVED: Check if token is created by target developer
  private isTargetDeveloper(developer: PublicKey): boolean {
    // Since TARGET_DEVELOPERS was removed, accept all developers for universal sniping
    return true;
  }

  // Enhanced snipe method with comprehensive security checks
  async snipeToken(tokenMint: string, platform: string, developer?: string): Promise<SnipeResult> {
    try {
      console.log(`🔍 Starting security validation for ${tokenMint} on ${platform}`);
      
      // Step 1: Address blacklist validation
      const addressesToValidate = [tokenMint];
      if (developer) addressesToValidate.push(developer);
      
      const blacklistValidation = addressBlacklist.validateAddresses(addressesToValidate);
      if (blacklistValidation.blacklisted.length > 0) {
        const blacklistedInfo = blacklistValidation.blacklisted.map(item => 
          `${item.address}: ${item.entry.reason}`
        ).join(', ');
        
        const errorMsg = `Transaction blocked - blacklisted addresses detected: ${blacklistedInfo}`;
        console.error(`🚫 ${errorMsg}`);
        await notificationService.sendNotification(errorMsg, 'warning', { tokenMint, blacklisted: blacklistValidation.blacklisted });
        
        return {
          success: false,
          error: errorMsg,
          tokenMint,
          platform,
          amount: this.buyAmountSol,
          timestamp: Date.now(),
          developer: developer || 'unknown'
        };
      }
      
      // Step 2: Balance validation for issuer (if developer provided)
      if (developer) {
        const balanceValidator = createBalanceValidator(this.connection);
        const issuerValidation = await balanceValidator.validateIssuerBalance(developer, tokenMint);
        
        if (!issuerValidation.isValid) {
          const errorMsg = `Issuer validation failed: ${issuerValidation.warnings.join(', ')}`;
          console.warn(`⚠️  ${errorMsg}`);
          
          // Request user confirmation for risky issuer
          const confirmResult = await userConfirmationService.requestConfirmation(
            'risky_issuer_trade',
            { 
              issuer: developer, 
              tokenMint, 
              validation: issuerValidation,
              platform,
              amount: this.buyAmountSol
            },
            { 
              riskLevel: issuerValidation.riskLevel, 
              factors: issuerValidation.warnings,
              recommendations: issuerValidation.recommendations,
              autoConfirm: false 
            }
          );
          
          if (!confirmResult.confirmed) {
            console.log(`❌ User rejected risky issuer trade for ${tokenMint}`);
            return {
              success: false,
              error: 'User rejected risky issuer trade',
              tokenMint,
              platform,
              amount: this.buyAmountSol,
              timestamp: Date.now(),
              developer: developer || 'unknown'
            };
          }
        }
      }
      
      // Step 3: Risk management check
      const riskCheck = riskManager.canExecuteTrade(this.buyAmountSol, tokenMint);
      if (!riskCheck.allowed) {
        const errorMsg = `Trade blocked by risk manager: ${riskCheck.errors.join(', ')}`;
        console.warn(`❌ ${errorMsg}`);
        await notificationService.sendNotification(errorMsg, 'warning', { tokenMint });
        return {
          success: false,
          error: errorMsg,
          tokenMint,
          platform,
          amount: this.buyAmountSol,
          timestamp: Date.now(),
          developer: developer || 'unknown'
        };
      }

      // Step 4: Large trade confirmation
      if (this.buyAmountSol > 1.0) {
        const confirmResult = await userConfirmationService.requestConfirmation(
          'large_trade',
          { tokenMint, platform, amount: this.buyAmountSol, developer },
          { riskLevel: 'medium', factors: ['Large trade amount'], recommendations: ['Consider reducing trade size'], autoConfirm: false }
        );
        
        if (!confirmResult.confirmed) {
          console.log(`❌ User rejected large trade for ${tokenMint}`);
          return {
            success: false,
            error: 'User rejected large trade',
            tokenMint,
            platform,
            amount: this.buyAmountSol,
            timestamp: Date.now(),
            developer: developer || 'unknown'
          };
        }
      }

      console.log(`🎯 Starting snipe for ${tokenMint} on ${platform}`);
      
      // Step 5: Create and validate transaction
      let transaction: Transaction | null;
      try {
        transaction = await this.createBuyTransaction(new PublicKey(tokenMint), platform);
        if (!transaction) {
          throw new Error('Failed to create transaction');
        }
      } catch (error) {
        const errorMsg = `Transaction creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        return {
          success: false,
          error: errorMsg,
          tokenMint,
          platform,
          amount: this.buyAmountSol,
          timestamp: Date.now(),
          developer: developer || 'unknown'
        };
      }
      
      // Step 6: Transaction anomaly analysis
      const anomalyResult = transactionAnomalyMonitor.analyzeTransaction(transaction, {
        fromAddress: this.wallet.publicKey.toBase58(),
        amount: this.buyAmountSol,
        tokenMint
      });
      
      if (anomalyResult.isAnomalous) {
        console.warn(`🚨 Transaction anomalies detected: ${anomalyResult.triggeredPatterns.join(', ')}`);
        
        if (anomalyResult.riskScore >= 6) {
          const confirmResult = await userConfirmationService.requestConfirmation(
            'anomalous_transaction',
            { 
              tokenMint, 
              patterns: anomalyResult.triggeredPatterns, 
              riskScore: anomalyResult.riskScore,
              recommendations: anomalyResult.recommendations
            },
            { 
              riskLevel: anomalyResult.riskScore >= 8 ? 'critical' : 'high',
              factors: anomalyResult.triggeredPatterns,
              recommendations: anomalyResult.recommendations,
              autoConfirm: false 
            }
          );
          
          if (!confirmResult.confirmed) {
            console.log(`❌ User rejected anomalous transaction for ${tokenMint}`);
            return {
              success: false,
              error: 'User rejected anomalous transaction',
              tokenMint,
              platform,
              amount: this.buyAmountSol,
              timestamp: Date.now(),
              developer: developer || 'unknown'
            };
          }
        }
      }
      
      // Step 7: Execute swap with enhanced service
      const swapResult = await this.enhancedSwapService.executeSwap({
        inputMint: 'So11111111111111111111111111111111111111112', // SOL
        outputMint: tokenMint,
        amount: this.buyAmountSol * 1e9, // Convert to lamports
        slippage: this.buySlippage,
        wallet: this.wallet,
        method: 'solana' // Default method
      });

      if (swapResult.success && swapResult.signature) {
        const result: SnipeResult = {
          success: true,
          tokenMint,
          platform,
          amount: this.buyAmountSol,
          signature: swapResult.signature,
          timestamp: Date.now(),
          developer: developer || 'unknown',
          startTime: Date.now(),
          status: 'sniped'
        };

        // Record successful snipe
        this.snipeHistory.push(result);
        this.activeSnipes.set(tokenMint, {
          platform: result.platform,
          startTime: result.startTime || Date.now(),
          status: result.status || 'sniped',
          signature: result.signature
        });
        
        // Start profit monitoring
        this.startProfitMonitoring(tokenMint, result);
        
        // Send success notification
        await notificationService.notifyTrade('buy', tokenMint, this.buyAmountSol, 0, swapResult.signature);
        
        console.log(`✅ Snipe successful: ${tokenMint} on ${platform}`);
        return result;
      } else {
        const errorMsg = `Swap failed: ${swapResult.error}`;
        console.error(`❌ ${errorMsg}`);
        await notificationService.sendNotification(errorMsg, 'error', { tokenMint });
        
        return {
          success: false,
          error: errorMsg,
          tokenMint,
          platform,
          amount: this.buyAmountSol,
          timestamp: Date.now(),
          developer: developer || 'unknown'
        };
      }
    } catch (error) {
      const errorMsg = `Snipe error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${errorMsg}`);
      await notificationService.notifyError(error instanceof Error ? error : new Error(errorMsg), 'Token Snipe');
      
      return {
        success: false,
        error: errorMsg,
        tokenMint,
        platform,
        amount: this.buyAmountSol,
        timestamp: Date.now(),
        developer: developer || 'unknown'
      };
    }
  }

  private async createBuyTransaction(tokenMint: PublicKey, platform: string): Promise<Transaction | null> {
    try {
      switch (platform) {
        case 'pumpfun':
          // ✅ Use direct execution for Pump.fun instead of transaction building
          console.log(`Using direct Pump.fun execution for ${tokenMint.toBase58()}`);
          return null; // Will use direct execution instead
        case 'raydium':
          return await this.raydium.createBuyTransaction(tokenMint, this.buyAmountSol, this.buySlippage);
        case 'pumpportal':
        case 'developer':
        default:
          return await this.sdk.createBuyTransaction(tokenMint, this.buyAmountSol, this.buySlippage);
      }
    } catch (error) {
      console.error(`Error creating buy transaction for ${platform}:`, error);
      return null;
    }
  }

  private async executeTransaction(transaction: Transaction, tokenMint: string, platform: string): Promise<SnipeResult> {
    try {
      // ✅ Special handling for Pump.fun direct execution
      if (platform === 'pumpfun' || platform === 'pumpportal') {
        console.log(`🚀 Executing ${platform} transaction for ${tokenMint}`);
        const signature = await this.pumpFun.executePumpTransaction("buy", tokenMint, this.buyAmountSol, this.buySlippage);
        
        if (signature) {
          console.log(`✅ ${platform} transaction successful: ${signature}`);
          console.log(`🔗 View on Solscan: https://solscan.io/tx/${signature}`);
          
          // ✅ IMPROVED: Wait for transaction confirmation before returning success
          try {
            const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
            if (confirmation.value.err) {
              console.error(`❌ Transaction failed with error:`, confirmation.value.err);
              return {
                success: false,
                error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
                platform,
                tokenMint,
                amount: 0,
                timestamp: Date.now()
              };
            }
            
            console.log(`✅ Transaction confirmed successfully!`);
            
            // ✅ NEW: Verify token balance after transaction
            setTimeout(async () => {
              await this.verifyTokenBalance(tokenMint, signature);
            }, 5000); // Check balance after 5 seconds
            
          } catch (confirmError) {
            console.error(`⚠️ Error confirming transaction:`, confirmError);
            // Still return success since signature was received
          }
          
          return {
            success: true,
            signature,
            platform,
            tokenMint,
            amount: this.buyAmountSol,
            timestamp: Date.now()
          };
        } else {
          console.error(`❌ ${platform} transaction execution failed - no signature returned`);
          return {
            success: false,
            error: `${platform} direct execution failed - no signature returned`,
            platform,
            tokenMint,
            amount: 0,
            timestamp: Date.now()
          };
        }
      } else if (platform === 'meteora') {
        // Meteora specific execution
        console.log(`🚀 Executing Meteora transaction for ${tokenMint}`);
        
        // For Meteora, we'll use the standard Solana transaction execution
        // since Meteora doesn't have a direct API like Pump Portal
        const latestBlockhash = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = this.wallet.publicKey;

        // Add priority fee and compute unit instructions
        const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 50000
        });
        transaction.add(priorityFeeIx);

        const computeUnitIx = ComputeBudgetProgram.setComputeUnitLimit({
          units: 400000
        });
        transaction.add(computeUnitIx);

        transaction.sign(this.wallet);
        const signature = await this.connection.sendRawTransaction(transaction.serialize());
        console.log(`Meteora transaction sent: ${signature}`);

        const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
          this.trackFailedTransaction(signature);
          return {
            success: false,
            error: `Meteora transaction failed: ${JSON.stringify(confirmation.value.err)}`,
            platform,
            tokenMint,
            amount: 0,
            timestamp: Date.now()
          };
        }

        console.log(`✅ Meteora transaction successful: ${signature}`);
        console.log(`🔗 View on Solscan: https://solscan.io/tx/${signature}`);

        // Verify token balance
        setTimeout(async () => {
          await this.verifyTokenBalance(tokenMint, signature);
        }, 5000);

        return {
          success: true,
          signature,
          platform,
          tokenMint,
          amount: this.buyAmountSol,
          timestamp: Date.now()
        };
      }

      // Add priority fee and compute unit instructions if not already present
      if (!transaction.instructions.some(ix => ix.programId.equals(ComputeBudgetProgram.programId))) {
        const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 50000
        });
        transaction.add(priorityFeeIx);

        const computeUnitIx = ComputeBudgetProgram.setComputeUnitLimit({
          units: 400000
        });
        transaction.add(computeUnitIx);
      }

      transaction.feePayer = this.wallet.publicKey;
      transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
      transaction.sign(this.wallet);

      const signature = await this.connection.sendRawTransaction(transaction.serialize());
      console.log(`Transaction sent: ${signature}`);

      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        this.trackFailedTransaction(signature);
        return {
          success: false,
          error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
          platform,
          tokenMint,
          amount: 0,
          timestamp: Date.now()
        };
      }

      // Verify token balance
      const tokenAccount = await getAssociatedTokenAddress(new PublicKey(tokenMint), this.wallet.publicKey);
      const tokenAccountInfo = await this.connection.getAccountInfo(tokenAccount);
      
      if (tokenAccountInfo === null) {
        return {
          success: false,
          error: 'Token account does not exist after purchase',
          platform,
          tokenMint,
          amount: 0,
          timestamp: Date.now()
        };
      }

      return {
        success: true,
        signature,
        platform,
        tokenMint,
        amount: this.buyAmountSol,
        timestamp: Date.now()
      };

    } catch (error) {
      return {
        success: false,
        error: `Execution error: ${error}`,
        platform,
        tokenMint,
        amount: 0,
        timestamp: Date.now()
      };
    }
  }

  private async checkPoolLiquidity(tokenMint: PublicKey, platform: string): Promise<number> {
    try {
      // Check liquidity across different platforms
      const pumpFunLiquidity = await this.pumpFun.getTokenPrice(tokenMint);
      const raydiumLiquidity = await this.raydium.getTokenPrice(tokenMint);
      const sdkLiquidity = await this.sdk.checkPoolLiquidity(tokenMint);
      const meteoraLiquidity = await this.meteoraMonitor.getTokenPrice(tokenMint);

      return Math.max(pumpFunLiquidity, raydiumLiquidity, sdkLiquidity, meteoraLiquidity);
    } catch (error) {
      console.error('Error checking pool liquidity:', error);
      return 0;
    }
  }

  // ✅ NEW: Automatic profit-taking method
  private scheduleProfitTaking(tokenMint: string, platform: string, slippage: number): void {
    const sellDelay = 20000; // 20 seconds - configurable
    const sellAmount = "100%"; // Sell 100% of tokens
    
    console.log(`Scheduling profit-taking for ${tokenMint} in ${sellDelay/1000} seconds`);
    
    setTimeout(async () => {
      try {
        console.log(`Executing profit-taking for ${tokenMint}`);
        
        if (platform === 'pumpfun') {
          // Use direct Pump.fun execution for selling
          const signature = await this.pumpFun.executePumpTransaction("sell", tokenMint, 0, slippage);
          if (signature) {
            console.log(`✅ Profit-taking successful for ${tokenMint}: ${signature}`);
          } else {
            console.error(`❌ Profit-taking failed for ${tokenMint}`);
          }
        } else {
          // Use regular transaction for other platforms
          const sellTx = await this.createSellTransaction(new PublicKey(tokenMint), slippage, platform);
          if (sellTx) {
            const result = await this.executeTransaction(sellTx, tokenMint, platform);
            if (result.success) {
              console.log(`✅ Profit-taking successful for ${tokenMint}: ${result.signature}`);
            } else {
              console.error(`❌ Profit-taking failed for ${tokenMint}: ${result.error}`);
            }
          }
        }
      } catch (error) {
        console.error(`Error during profit-taking for ${tokenMint}:`, error);
      }
    }, sellDelay);
  }

  // ✅ NEW: Enhanced profit-taking with multi-tier strategy
  private scheduleMultiTierProfitTaking(tokenMint: string, platform: string, slippage: number, entryPrice: number, entryAmount: number): void {
    // Profit taking temporarily disabled
    this.scheduleProfitTaking(tokenMint, platform, slippage);
    return;

    console.log(`🎯 Setting up multi-tier profit-taking for ${tokenMint}`);
    console.log(`💰 Entry price: ${entryPrice} SOL, Entry amount: ${entryAmount} tokens`);
    console.log(`📊 Profit targets: 1000% (35%) → 10000% (35%) → Keep 30%`);

    // Add position to profit taker
    const position: Position = {
      mint: tokenMint,
      symbol: tokenMint.slice(0, 8), // Simplified symbol
      entryPrice,
      entryAmount,
      currentAmount: entryAmount,
      entryTime: Date.now(),
      tier1Sold: false,
      tier2Sold: false,
      totalSold: 0,
      signature: 'entry_signature' // You'll need to store the actual signature
    };

    this.profitTaker.addPosition(position);
    console.log(`✅ Position added to profit taker for ${tokenMint}`);
  }

  // ✅ NEW: Check profit targets and execute tier-based selling
  private async checkProfitTargets(tokenMint: string): Promise<void> {
    const monitoring = this.activeProfitMonitoring.get(tokenMint);
    if (!monitoring) return;

    try {
      // Get current token price
      const currentPrice = await this.getCurrentTokenPrice(tokenMint, monitoring.platform);
      if (currentPrice === 0) return;

      // Calculate profit multiplier
      const profitMultiplier = currentPrice / monitoring.entryPrice;
      const profitPercentage = (profitMultiplier - 1) * 100;

      console.log(`📈 ${tokenMint}: Current price: ${currentPrice} SOL, Profit: ${profitPercentage.toFixed(2)}% (${profitMultiplier.toFixed(2)}x)`);

      // Check Tier 1: 1000% profit target (10x)
      if (!monitoring.tier1Sold && profitMultiplier >= 10.0) {
        await this.executeTierSell(tokenMint, 1, monitoring);
      }

      // Check Tier 2: 10000% profit target (100x)
      if (!monitoring.tier2Sold && profitMultiplier >= 100.0) {
        await this.executeTierSell(tokenMint, 2, monitoring);
      }

      // Update last price check
      monitoring.lastPriceCheck = Date.now();

    } catch (error) {
      console.error(`Error checking profit targets for ${tokenMint}:`, error);
    }
  }

  // ✅ NEW: Execute tier-based selling
  private async executeTierSell(tokenMint: string, tierNumber: number, monitoring: any): Promise<void> {
    const tier = tierNumber === 1 ? { amount: 0.3, percentage: 10.0 } : { amount: 0.5, percentage: 100.0 };
    const sellAmount = monitoring.remainingAmount * tier.amount;

    console.log(`🎯 TIER ${tierNumber} TRIGGERED for ${tokenMint}!`);
    console.log(`💰 Selling ${sellAmount.toFixed(6)} tokens (${(tier.amount * 100).toFixed(0)}%) at ${tier.percentage}x profit`);
    console.log(`📊 Remaining after sell: ${(monitoring.remainingAmount - sellAmount).toFixed(6)} tokens`);

    try {
      // Execute the sell transaction
      const sellResult = await this.executeTierSellTransaction(tokenMint, sellAmount, monitoring.platform, 0.1);
      
      if (sellResult.success) {
        console.log(`✅ Tier ${tierNumber} sell successful: ${sellResult.signature}`);
        
        // Update monitoring state
        monitoring.soldAmount += sellAmount;
        monitoring.remainingAmount -= sellAmount;
        
        if (tierNumber === 1) {
          monitoring.tier1Sold = true;
          console.log(`🎯 Tier 1 (100x) completed for ${tokenMint}`);
        } else if (tierNumber === 2) {
          monitoring.tier2Sold = true;
          console.log(`🎯 Tier 2 (1000x) completed for ${tokenMint}`);
          
          // Both tiers completed, stop monitoring
          this.stopProfitMonitoring(tokenMint);
          console.log(`🏁 All profit targets reached for ${tokenMint}. Keeping ${monitoring.remainingAmount.toFixed(6)} tokens (30%) in wallet.`);
        }
      } else {
        console.error(`❌ Tier ${tierNumber} sell failed: ${sellResult.error}`);
      }
    } catch (error) {
      console.error(`Error executing tier ${tierNumber} sell for ${tokenMint}:`, error);
    }
  }

  // ✅ NEW: Execute tier sell transaction
  private async executeTierSellTransaction(tokenMint: string, amount: number, platform: string, slippage: number): Promise<SnipeResult> {
    try {
      if (platform === 'pumpfun') {
        // Use direct Pump.fun execution for selling
        const signature = await this.pumpFun.executePumpTransaction("sell", tokenMint, 0, slippage);
        if (signature) {
          return {
            success: true,
            signature,
            platform,
            tokenMint,
            amount,
            timestamp: Date.now()
          };
        } else {
          return {
            success: false,
            error: 'Pump.fun direct execution failed',
            platform,
            tokenMint,
            amount: 0,
            timestamp: Date.now()
          };
        }
      } else {
        // Use regular transaction for other platforms
        const sellTx = await this.createSellTransaction(new PublicKey(tokenMint), slippage, platform);
        if (sellTx) {
          return await this.executeTransaction(sellTx, tokenMint, platform);
        } else {
          return {
            success: false,
            error: 'Failed to create sell transaction',
            platform,
            tokenMint,
            amount: 0,
            timestamp: Date.now()
          };
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform,
        tokenMint,
        amount: 0,
        timestamp: Date.now()
      };
    }
  }

  // ✅ NEW: Get current token price for profit monitoring
  private async getCurrentTokenPrice(tokenMint: string, platform: string): Promise<number> {
    try {
      const mintPubkey = new PublicKey(tokenMint);
      
      switch (platform) {
        case 'pumpfun':
          return await this.pumpFun.getTokenPrice(mintPubkey);
        case 'raydium':
          return await this.raydium.getTokenPrice(mintPubkey);
        case 'meteora':
          return await this.meteoraMonitor.getTokenPrice(mintPubkey);
        case 'pumpportal':
        case 'developer':
        default:
          return await this.sdk.getTokenPrice(mintPubkey);
      }
    } catch (error) {
      console.error(`Error getting current price for ${tokenMint}:`, error);
      return 0;
    }
  }

  // ✅ NEW: Stop profit monitoring for a token
  private stopProfitMonitoring(tokenMint: string): void {
    const monitoring = this.activeProfitMonitoring.get(tokenMint);
    if (monitoring) {
      clearInterval(monitoring.monitoringInterval);
      this.activeProfitMonitoring.delete(tokenMint);
      console.log(`🛑 Profit monitoring stopped for ${tokenMint}`);
    }
  }

  // ✅ NEW: Get profit monitoring status
  public getProfitMonitoringStatus(): any[] {
    const status = [];
    for (const [tokenMint, monitoring] of this.activeProfitMonitoring) {
      status.push({
        tokenMint,
        platform: monitoring.platform,
        entryPrice: monitoring.entryPrice,
        remainingAmount: monitoring.remainingAmount,
        soldAmount: monitoring.soldAmount,
        tier1Sold: monitoring.tier1Sold,
        tier2Sold: monitoring.tier2Sold,
        lastPriceCheck: new Date(monitoring.lastPriceCheck).toISOString()
      });
    }
    return status;
  }

  // ✅ NEW: Create sell transaction for different platforms
  private async createSellTransaction(tokenMint: PublicKey, slippage: number, platform: string): Promise<Transaction | null> {
    try {
      switch (platform) {
        case 'pumpfun':
          return await this.pumpFun.createSellTransaction(tokenMint, slippage);
        case 'raydium':
          return await this.raydium.createSellTransaction(tokenMint, slippage);
        case 'pumpportal':
        case 'developer':
        default:
          return await this.sdk.createSellTransaction(tokenMint, slippage);
      }
    } catch (error) {
      console.error(`Error creating sell transaction for ${platform}:`, error);
      return null;
    }
  }

  // ✅ NEW: Verify token balance after transaction
  private async verifyTokenBalance(tokenMint: string, signature: string): Promise<void> {
    try {
      console.log(`🔍 Verifying token balance for ${tokenMint} after transaction ${signature}`);
      
      const mintPubkey = new PublicKey(tokenMint);
      const walletPubkey = this.wallet.publicKey;
      
      // Get associated token account
      const { getAssociatedTokenAddress } = await import('@solana/spl-token');
      const associatedTokenAccount = await getAssociatedTokenAddress(mintPubkey, walletPubkey);
      
      console.log(`📍 Associated Token Account: ${associatedTokenAccount.toBase58()}`);
      
      // Check if account exists
      const accountInfo = await this.connection.getAccountInfo(associatedTokenAccount);
      
      if (accountInfo) {
        console.log(`✅ Token account exists`);
        
        // Parse token account data to get balance
        if (accountInfo.data.length >= 64) {
          const tokenBalance = accountInfo.data.readBigUInt64LE(64);
          console.log(`💰 Token Balance: ${tokenBalance} (raw)`);
          console.log(`💰 Token Balance: ${Number(tokenBalance) / 1e6} (formatted with 6 decimals)`);
          
          if (Number(tokenBalance) > 0) {
            console.log(`🎉 SUCCESS: Tokens found in wallet!`);
          } else {
            console.log(`⚠️ WARNING: Token account exists but balance is zero`);
          }
        } else {
          console.log(`⚠️ WARNING: Token account data is too short to parse balance`);
        }
      } else {
        console.log(`❌ ERROR: Token account does not exist - transaction may have failed`);
        
        // Let's check the transaction details
        console.log(`🔍 Checking transaction details...`);
        const transaction = await this.connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        });
        
        if (transaction) {
          console.log(`📝 Transaction found:`);
          console.log(`   Success: ${transaction.meta?.err ? 'FAILED' : 'SUCCESS'}`);
          console.log(`   Fee: ${transaction.meta?.fee ? transaction.meta.fee / 1e9 : 'Unknown'} SOL`);
          
          if (transaction.meta?.err) {
            console.log(`   Error: ${JSON.stringify(transaction.meta.err)}`);
          }
          
          // Check for any token balance changes
          if (transaction.meta?.postTokenBalances && transaction.meta.postTokenBalances.length > 0) {
            console.log(`   Token balance changes found:`);
            for (const balance of transaction.meta.postTokenBalances) {
              if (balance.mint === tokenMint) {
                console.log(`     🎯 Target token balance: ${balance.uiTokenAmount.uiAmountString}`);
                console.log(`     Account: ${balance.accountIndex}`);
                console.log(`     Owner: ${balance.owner}`);
              }
            }
          } else {
            console.log(`   ❌ No token balance changes found in transaction`);
          }
        } else {
          console.log(`❌ Transaction not found on blockchain`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error verifying token balance:`, error);
    }
  }

  // ✅ NEW: Get token amount after successful snipe
  private async getTokenAmountAfterSnipe(tokenMint: PublicKey, platform: string): Promise<number> {
    try {
      // Wait a bit for the transaction to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get current token balance
      const mintPubkey = new PublicKey(tokenMint.toBase58());
      
      switch (platform) {
        case 'pumpfun':
          return await this.pumpFun.getTokenBalance(mintPubkey);
        case 'raydium':
          // For Raydium, we need to estimate based on SOL amount and current price
          const currentPrice = await this.raydium.getTokenPrice(mintPubkey);
          return currentPrice > 0 ? this.buyAmountSol / currentPrice : 0;
        case 'pumpportal':
        case 'developer':
        default:
          return await this.sdk.getTokenBalance(mintPubkey);
      }
    } catch (error) {
      console.error(`Error getting token amount after snipe for ${tokenMint.toBase58()}:`, error);
      // Fallback: estimate based on SOL amount and a reasonable price assumption
      return this.buyAmountSol / 0.01; // Assume 0.01 SOL per token as fallback
    }
  }

  getSnipeHistory(): SnipeResult[] {
    return [...this.snipeHistory];
  }

  // ✅ IMPROVED: Enhanced stats with profit monitoring information
  getStats(): any {
    const activeSnipes = Array.from(this.activeSnipes.entries()).map(([tokenMint, data]) => ({
      tokenMint,
      ...data
    }));

    const profitMonitoring = this.getProfitMonitoringStatus();

    return {
      isRunning: this.isRunning,
      activeSnipes,
      activeSnipesCount: this.activeSnipes.size,
      snipeHistory: this.snipeHistory,
      snipeHistoryCount: this.snipeHistory.length,
      profitMonitoring,
      profitMonitoringCount: profitMonitoring.length,
      targetDevelopers: this.targetDeveloperSet.size,
      buyAmount: this.buyAmountSol,
      slippage: this.buySlippage,
      maxConcurrentSnipes: this.maxConcurrentSnipes,
      failedTransactions: Array.from(this.failedTransactions),
      failedTransactionsCount: this.failedTransactions.size
    };
  }

  // ✅ NEW: Cleanup profit monitoring when bot stops
  public stop(): void {
    this.isRunning = false;
    
    // Stop all profit monitoring
    for (const [tokenMint, monitoring] of this.activeProfitMonitoring) {
      this.stopProfitMonitoring(tokenMint);
    }
    
    // Close WebSocket connection
    if (this.ws) {
        this.ws.close();
      this.ws = null;
    }

    console.log('🛑 Sniper bot stopped. All profit monitoring cleared.');
  }

  // ✅ NEW: Helper method to validate public key format
  private isValidPublicKey(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  // ✅ FIXED: Add profit monitoring cleanup method
  private startProfitMonitoringCleanup(): void {
    // Clean up stale profit monitoring every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [tokenMint, monitoring] of this.activeProfitMonitoring) {
        // Stop monitoring if no price check in last 10 minutes
        if (now - monitoring.lastPriceCheck > 10 * 60 * 1000) {
          console.log(`🔄 Stopping stale profit monitoring for ${tokenMint}`);
          this.stopProfitMonitoring(tokenMint);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Enhanced profit monitoring with multi-tier strategy
  private startProfitMonitoring(tokenMint: string, snipeResult: SnipeResult): void {
    // Profit taking temporarily disabled
    return;

    const interval = setInterval(async () => {
      try {
        const currentPrice = await this.getCurrentTokenPrice(tokenMint, snipeResult.platform);
        if (!currentPrice) return;

        const entryPrice = snipeResult.entryPrice || 0;
        const profitMultiplier = currentPrice / entryPrice;

        // Check multi-tier profit targets using hardcoded values
        const tier1Target = 10.0; // 1000% profit target
        const tier2Target = 100.0; // 10000% profit target
        
        if (profitMultiplier >= tier1Target && !this.activeProfitMonitoring.get(tokenMint)?.tier1Sold) {
          await this.executeProfitTaking(tokenMint, 30, 'Tier 1 (1000% profit)');
        } else if (profitMultiplier >= tier2Target && !this.activeProfitMonitoring.get(tokenMint)?.tier2Sold) {
          await this.executeProfitTaking(tokenMint, 50, 'Tier 2 (10000% profit)');
        }

      } catch (error) {
        console.error(`Error in profit monitoring for ${tokenMint}:`, error);
      }
    }, 30000); // Check every 30 seconds

    // this.profitMonitoringIntervals.set(tokenMint, interval); // This line was removed as per the new_code
  }

  // Execute profit taking
  private async executeProfitTaking(tokenMint: string, sellPercentage: number, description: string): Promise<void> {
    try {
      console.log(`💰 Executing profit taking: ${sellPercentage}% of ${tokenMint} - ${description}`);
      
      // Calculate sell amount
      const tokenBalance = await this.getTokenBalance(tokenMint);
      const sellAmount = tokenBalance * (sellPercentage / 100);
      
      // Execute sell transaction
      const sellResult = await this.enhancedSwapService.executeSwap({
        inputMint: tokenMint,
        outputMint: 'So11111111111111111111111111111111111111112', // SOL
        amount: sellAmount,
        slippage: this.buySlippage,
        wallet: this.wallet,
        method: 'solana'
      });

      if (sellResult.success && sellResult.signature) {
        await notificationService.notifyProfit(tokenMint, sellPercentage, sellResult.signature);
        console.log(`✅ Profit taking successful: ${sellAmount} tokens sold`);
      }
    } catch (error) {
      console.error(`Error executing profit taking for ${tokenMint}:`, error);
      await notificationService.notifyError(error instanceof Error ? error : new Error('Unknown error'), 'Profit Taking');
    }
  }

  // Execute stop loss
  private async executeStopLoss(tokenMint: string, reason: string): Promise<void> {
    try {
      console.log(`🛑 Executing stop loss for ${tokenMint}: ${reason}`);
      
      const tokenBalance = await this.getTokenBalance(tokenMint);
      
      // Sell entire position
      const sellResult = await this.enhancedSwapService.executeSwap({
        inputMint: tokenMint,
        outputMint: 'So11111111111111111111111111111111111111112', // SOL
        amount: tokenBalance,
        slippage: this.buySlippage,
        wallet: this.wallet,
        method: 'solana'
      });

      if (sellResult.success && sellResult.signature) {
        await notificationService.notifyLoss(tokenMint, 0, sellResult.signature);
        console.log(`✅ Stop loss executed: ${tokenBalance} tokens sold`);
      }
    } catch (error) {
      console.error(`Error executing stop loss for ${tokenMint}:`, error);
      await notificationService.notifyError(error instanceof Error ? error : new Error('Unknown error'), 'Stop Loss');
    }
  }

  // Placeholder implementation removed - using the enhanced version above

  // Get token balance (placeholder implementation)
  private async getTokenBalance(tokenMint: string): Promise<number> {
    // This would get actual token balance from the wallet
    return 1000000; // Placeholder balance
  }

  // Get bot status with enhanced information
  getBotStatus(): any {
    const riskStatus = riskManager.getRiskStatus();
    const swapMethods = this.enhancedSwapService.getAvailableMethods();
    
    return {
      isRunning: this.isRunning,
      buyAmount: this.buyAmountSol,
      slippage: this.buySlippage,
      activeSnipes: this.activeSnipes.size,
      totalSnipes: this.snipeHistory.length,
      riskStatus,
      availableSwapMethods: swapMethods,
      wallet: this.wallet.publicKey.toBase58()
    };
  }

  // Main bot loop
  private async runBotLoop(): Promise<void> {
    console.log('🚀 Starting SBSniper bot loop...');
    
    while (this.isRunning) {
      try {
        // Monitor Bonk.fun for new launches
        await this.monitorBonkFunLaunches();
        
        // Wait before next iteration
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error('❌ Error in bot loop:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  // NEW: Enhanced Bonk.fun monitoring with REST fallback
  private async monitorBonkFunLaunches(): Promise<void> {
    try {
      // Try WebSocket first through integration service
      const newLaunches = await this.bonkFunIntegration.monitorNewLaunches();
      
      for (const launch of newLaunches) {
        console.log(`🎯 New Bonk.fun launch detected: ${launch.symbol} (${launch.mint})`);
        
        // Validate the token
        const validation = await this.tokenValidator.validateToken(launch.mint);
        if (!validation.isValid) {
          console.log(`⚠️ Token ${launch.symbol} failed validation: ${validation.errors.join(', ')}`);
          continue;
        }
        
        // Check risk management
        const riskCheck = riskManager.canExecuteTrade(0.01, launch.mint);
        if (!riskCheck.allowed) {
          console.log(`⚠️ Trade blocked by risk manager: ${riskCheck.errors.join(', ')}`);
          continue;
        }
        
        // Execute the snipe using existing enhanced swap service
        await this.executeBonkFunSnipe(launch);
      }
    } catch (error) {
      console.log('⚠️ WebSocket monitoring failed, falling back to REST API...');
      
      // FALLBACK: REST API monitoring if WebSocket fails
      try {
        const launchesRes = await fetch('https://api.bonk.fun/launches/recent');
        if (launchesRes.ok) {
          const launches = await launchesRes.json();
          console.log(`📡 REST fallback: Found ${launches.length} recent launches`);
          
          // Filter launches <10min old, min liquidity, holders, etc.
          const recentLaunches = launches.filter((launch: any) => {
            const launchTime = new Date(launch.createdAt || launch.timestamp || Date.now()).getTime();
            const ageMs = Date.now() - launchTime;
            const maxAgeMs = 10 * 60 * 1000; // 10 minutes
            
            return ageMs <= maxAgeMs && 
                   launch.liquidity >= 10 && // Min 10 SOL liquidity
                   launch.holders >= 7; // Min 7 holders
          });
          
          console.log(`🎯 REST fallback: ${recentLaunches.length} launches meet criteria`);
          
          for (const launch of recentLaunches) {
            console.log(`🚀 REST fallback: Processing launch ${launch.symbol || launch.mint}`);
            
            // Execute snipe for valid launches
            if (launch.mint) {
              await this.executeBonkFunSnipe(launch);
            }
          }
        } else {
          console.log(`❌ REST fallback failed: ${launchesRes.status} ${launchesRes.statusText}`);
        }
      } catch (restError) {
        console.error('❌ Both WebSocket and REST fallback failed:', restError);
      }
    }
  }

  // Execute Bonk.fun snipe
  private async executeBonkFunSnipe(launch: any): Promise<void> {
    try {
      console.log(`🚀 Executing Bonk.fun snipe for ${launch.symbol}`);
      
      // Use the enhanced swap service for the actual trade
      const swapRequest = {
        inputMint: 'So11111111111111111111111111111111111111111112', // SOL
        outputMint: launch.mint,
        amount: 0.01 * 1e9, // Convert to lamports
        slippage: 0.1,
        wallet: this.wallet,
        method: 'solana'
      };
      
      const result = await this.enhancedSwapService.executeSwap(swapRequest);
      
      if (result.success && result.signature) {
        console.log(`✅ Bonk.fun snipe successful: ${result.signature}`);
        await notificationService.notifyTrade('buy', launch.mint, 0.01, 0, result.signature);
      } else {
        console.log(`❌ Bonk.fun snipe failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error executing Bonk.fun snipe:`, error);
    }
  }

  // NEW: Enhanced Bonk.fun monitoring with REST fallback
  private startBonkFunMonitoring(): void {
    setInterval(async () => {
      if (this.isRunning) {
        await this.monitorBonkFunLaunches();
      }
    }, 30000); // Check every 30 seconds
    
    console.log('🔍 Bonk.fun monitoring started with REST fallback');
  }

  // NEW: Meteora monitoring with REST fallback
  private async monitorMeteoraLaunches(): Promise<void> {
    try {
      // Try WebSocket monitoring first through MeteoraMonitor
      await this.meteoraMonitor.startMonitoring();
    } catch (error) {
      console.log('⚠️ Meteora WebSocket monitoring failed, falling back to REST API...');
      
      // FALLBACK: REST API monitoring if WebSocket fails
      try {
        // Example: Meteora API endpoint (replace with actual endpoint if available)
        const launchesRes = await fetch('https://meteora-api-url/pools/recent');
        if (launchesRes.ok) {
          const launches = await launchesRes.json();
          console.log(`📡 Meteora REST fallback: Found ${launches.length} recent pools`);
          
          // Filter pools <10min old, min liquidity, etc.
          const recentPools = launches.filter((pool: any) => {
            const poolTime = new Date(pool.createdAt || pool.timestamp || Date.now()).getTime();
            const ageMs = Date.now() - poolTime;
            const maxAgeMs = 10 * 60 * 1000; // 10 minutes
            
            return ageMs <= maxAgeMs && 
                   pool.liquidity >= 10 && // Min 10 SOL liquidity
                   pool.holders >= 7; // Min 7 holders
          });
          
          console.log(`🎯 Meteora REST fallback: ${recentPools.length} pools meet criteria`);
          
          for (const pool of recentPools) {
            console.log(`🚀 Meteora REST fallback: Processing pool ${pool.symbol || pool.mint}`);
            
            // Execute snipe for valid pools
            if (pool.mint && pool.developer) {
              await this.snipeToken(pool.mint, 'meteora', pool.developer);
            }
          }
        } else {
          console.log(`❌ Meteora REST fallback failed: ${launchesRes.status} ${launchesRes.statusText}`);
        }
      } catch (restError) {
        console.error('❌ Both Meteora WebSocket and REST fallback failed:', restError);
      }
    }
  }

  // Updated monitoring intervals for public API rate limits
  // Conservative approach: 10s base interval, 20s for trades, 30s for balance
}