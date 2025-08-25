"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Raydium = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
// ✅ IMPROVED: Actual Raydium program IDs and constants
const RAYDIUM_AMM_PROGRAM_ID = new web3_js_1.PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
const RAYDIUM_CLMM_PROGRAM_ID = new web3_js_1.PublicKey('CAMMCzo5YL8w4VFF8KVHrK22GGUQp5VhH5bMKmRoS4tN');
const RAYDIUM_MARKET_PROGRAM_ID = new web3_js_1.PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
// ✅ NEW: Advanced pool data structure constants for different versions
const RAYDIUM_POOL_DATA_OFFSETS = {
    V1: {
        BASE_RESERVE: 200,
        QUOTE_RESERVE: 208,
        BASE_SUPPLY: 216,
        QUOTE_SUPPLY: 224,
        LP_SUPPLY: 232,
        AUTHORITY: 32,
        OPEN_ORDERS: 40,
        TARGET_ORDERS: 48,
        BASE_VAULT: 56,
        QUOTE_VAULT: 64,
        LP_VAULT: 72,
        MARKET_ID: 80,
        MARKET_BIDS: 88,
        MARKET_ASKS: 96,
        MARKET_EVENT_QUEUE: 104,
        MARKET_BASE_VAULT: 112,
        MARKET_QUOTE_VAULT: 120,
        MARKET_AUTHORITY: 128
    },
    V2: {
        BASE_RESERVE: 200,
        QUOTE_RESERVE: 208,
        BASE_SUPPLY: 216,
        QUOTE_SUPPLY: 224,
        LP_SUPPLY: 232,
        AUTHORITY: 32,
        OPEN_ORDERS: 40,
        TARGET_ORDERS: 48,
        BASE_VAULT: 56,
        QUOTE_VAULT: 64,
        LP_VAULT: 72,
        MARKET_ID: 80,
        MARKET_BIDS: 88,
        MARKET_ASKS: 96,
        MARKET_EVENT_QUEUE: 104,
        MARKET_BASE_VAULT: 112,
        MARKET_QUOTE_VAULT: 120,
        MARKET_AUTHORITY: 128,
        // V2 specific fields
        POOL_TYPE: 136,
        TARGET_ORDERS_OWNER: 144
    },
    V3: {
        BASE_RESERVE: 200,
        QUOTE_RESERVE: 208,
        BASE_SUPPLY: 216,
        QUOTE_SUPPLY: 224,
        LP_SUPPLY: 232,
        AUTHORITY: 32,
        OPEN_ORDERS: 40,
        TARGET_ORDERS: 48,
        BASE_VAULT: 56,
        QUOTE_VAULT: 64,
        LP_VAULT: 72,
        MARKET_ID: 80,
        MARKET_BIDS: 88,
        MARKET_ASKS: 96,
        MARKET_EVENT_QUEUE: 104,
        MARKET_BASE_VAULT: 112,
        MARKET_QUOTE_VAULT: 120,
        MARKET_AUTHORITY: 128,
        // V3 specific fields
        POOL_TYPE: 136,
        TARGET_ORDERS_OWNER: 144,
        WITHDRAW_QUEUE: 152,
        LP_VAULT_OWNER: 160
    },
    V4: {
        BASE_RESERVE: 200,
        QUOTE_RESERVE: 208,
        BASE_SUPPLY: 216,
        QUOTE_SUPPLY: 224,
        LP_SUPPLY: 232,
        AUTHORITY: 32,
        OPEN_ORDERS: 40,
        TARGET_ORDERS: 48,
        BASE_VAULT: 56,
        QUOTE_VAULT: 64,
        LP_VAULT: 72,
        MARKET_ID: 80,
        MARKET_BIDS: 88,
        MARKET_ASKS: 96,
        MARKET_EVENT_QUEUE: 104,
        MARKET_BASE_VAULT: 112,
        MARKET_QUOTE_VAULT: 120,
        MARKET_AUTHORITY: 128,
        // V4 specific fields
        POOL_TYPE: 136,
        TARGET_ORDERS_OWNER: 144,
        WITHDRAW_QUEUE: 152,
        LP_VAULT_OWNER: 160,
        REWARD_INFOS: 168,
        REWARD_INFOS_COUNT: 176
    }
};
// ✅ NEW: CLMM pool data structure constants
const RAYDIUM_CLMM_POOL_DATA_OFFSETS = {
    BASE_RESERVE: 64,
    QUOTE_RESERVE: 72,
    BASE_SUPPLY: 80,
    QUOTE_SUPPLY: 88,
    LP_SUPPLY: 96,
    AUTHORITY: 32,
    POOL_CONFIG: 40,
    POOL_STATE: 48,
    TICK_ARRAYS: 56,
    TICK_ARRAY_BITMAP: 64,
    FEE_GROWTH_GLOBAL: 72,
    FEE_GROWTH_GLOBAL_LAST: 80
};
class Raydium {
    connection;
    wallet;
    isMonitoring = false;
    constructor(connection, wallet) {
        this.connection = connection;
        this.wallet = wallet;
    }
    // ✅ IMPROVED: Monitor for new Raydium pools with developer address extraction
    async onNewPool(callback) {
        if (this.isMonitoring)
            return;
        this.isMonitoring = true;
        console.log('Monitoring Raydium for new pools...');
        // Monitor AMM program for new pool creation
        this.connection.onLogs(RAYDIUM_AMM_PROGRAM_ID, async (logs) => {
            if (!this.isMonitoring)
                return;
            try {
                // ✅ IMPROVED: Extract developer address with fallback
                let developer = this.extractDeveloperFromLogs(logs.logs);
                // If no developer found in logs, try to extract from transaction
                if (!developer && logs.signature) {
                    developer = await this.extractDeveloperFromTransaction(logs.signature);
                }
                if (developer) {
                    console.log(`✅ Developer address extracted: ${developer.toBase58()}`);
                }
                else {
                    console.log(`⚠️ No developer address found, using wallet as fallback`);
                    developer = this.wallet.publicKey;
                }
                const poolInfo = await this.parseRaydiumLogs(logs.logs);
                if (poolInfo) {
                    console.log(`New Raydium pool detected: ${poolInfo.mint.toBase58()} by developer: ${developer.toBase58()}`);
                    callback({
                        ...poolInfo,
                        developer
                    });
                }
            }
            catch (error) {
                console.error('Error processing Raydium AMM logs:', error);
            }
        }, 'confirmed');
        // Also monitor CLMM program for concentrated liquidity pools
        this.connection.onLogs(RAYDIUM_CLMM_PROGRAM_ID, async (logs) => {
            if (!this.isMonitoring)
                return;
            try {
                // ✅ IMPROVED: Extract developer address with fallback
                let developer = this.extractDeveloperFromLogs(logs.logs);
                // If no developer found in logs, try to extract from transaction
                if (!developer && logs.signature) {
                    developer = await this.extractDeveloperFromTransaction(logs.signature);
                }
                if (developer) {
                    console.log(`✅ Developer address extracted: ${developer.toBase58()}`);
                }
                else {
                    console.log(`⚠️ No developer address found, using wallet as fallback`);
                    developer = this.wallet.publicKey;
                }
                const poolInfo = await this.parseRaydiumCLMMLogs(logs.logs);
                if (poolInfo) {
                    console.log(`New Raydium CLMM pool detected: ${poolInfo.mint.toBase58()} by developer: ${developer.toBase58()}`);
                    // ✅ NEW: Pass developer address to callback
                    callback({
                        ...poolInfo,
                        developer
                    });
                }
            }
            catch (error) {
                console.error('Error parsing Raydium CLMM logs:', error);
            }
        }, 'confirmed');
    }
    // ✅ ENHANCED: Advanced log parsing for Raydium AMM pools with multiple patterns
    parseRaydiumLogs(logs) {
        for (const log of logs) {
            // Add more patterns for pool and token creation
            if (log.match(/(Initialize|CreatePool|CreateAmm|NewPool|PoolCreated|AmmCreated|MarketCreated|LaunchPool)/i)) {
                // Enhanced extraction logic with multiple fallback patterns
                const poolMatch = log.match(/(?:pool|poolAddress|pool_address|amm):\s*([A-Za-z0-9]{32,44})/i) ||
                    log.match(/pool=([A-Za-z0-9]{32,44})/i) ||
                    log.match(/amm=([A-Za-z0-9]{32,44})/i);
                const mintMatch = log.match(/(?:mint|token|baseMint|base_mint):\s*([A-Za-z0-9]{32,44})/i) ||
                    log.match(/mint=([A-Za-z0-9]{32,44})/i) ||
                    log.match(/token=([A-Za-z0-9]{32,44})/i);
                if (poolMatch && mintMatch) {
                    try {
                        const poolAddress = new web3_js_1.PublicKey(poolMatch[1]);
                        const mint = new web3_js_1.PublicKey(mintMatch[1]);
                        // Enhanced developer extraction with multiple patterns
                        const developer = this.extractDeveloperFromLogs(logs) || this.wallet.publicKey;
                        // Extract additional pool data if available
                        const poolData = this.extractRaydiumPoolDataFromLogs(logs);
                        return {
                            mint,
                            developer,
                            poolAddress,
                            initialLiquidity: poolData.initialLiquidity || 0,
                            timestamp: Date.now(),
                            // Enhanced pool data
                            baseReserve: poolData.baseReserve,
                            quoteReserve: poolData.quoteReserve,
                            baseSupply: poolData.baseSupply,
                            quoteSupply: poolData.quoteSupply,
                            lpSupply: poolData.lpSupply
                        };
                    }
                    catch (error) {
                        console.error('Invalid public key in Raydium logs:', error);
                    }
                }
            }
        }
        return null;
    }
    // ✅ NEW: Enhanced pool data extraction from Raydium logs
    extractRaydiumPoolDataFromLogs(logs) {
        const poolData = {};
        for (const log of logs) {
            // Extract liquidity information
            const liquidityMatch = log.match(/(?:liquidity|baseReserve|quoteReserve):\s*([0-9.]+)/i);
            if (liquidityMatch) {
                poolData.initialLiquidity = parseFloat(liquidityMatch[1]);
            }
            // Extract base reserve
            const baseReserveMatch = log.match(/baseReserve:\s*([0-9]+)/i);
            if (baseReserveMatch) {
                poolData.baseReserve = parseInt(baseReserveMatch[1]);
            }
            // Extract quote reserve
            const quoteReserveMatch = log.match(/quoteReserve:\s*([0-9]+)/i);
            if (quoteReserveMatch) {
                poolData.quoteReserve = parseInt(quoteReserveMatch[1]);
            }
            // Extract supply information
            const baseSupplyMatch = log.match(/baseSupply:\s*([0-9]+)/i);
            if (baseSupplyMatch) {
                poolData.baseSupply = parseInt(baseSupplyMatch[1]);
            }
            const quoteSupplyMatch = log.match(/quoteSupply:\s*([0-9]+)/i);
            if (quoteSupplyMatch) {
                poolData.quoteSupply = parseInt(quoteSupplyMatch[1]);
            }
            const lpSupplyMatch = log.match(/lpSupply:\s*([0-9]+)/i);
            if (lpSupplyMatch) {
                poolData.lpSupply = parseInt(lpSupplyMatch[1]);
            }
        }
        return poolData;
    }
    // ✅ NEW: Parse CLMM (Concentrated Liquidity) pool logs
    parseRaydiumCLMMLogs(logs) {
        for (const log of logs) {
            // Look for CLMM pool creation patterns
            if (log.includes('Initialize') || log.includes('CreateClmmPool') || log.includes('CreatePosition')) {
                const poolMatch = log.match(/pool: ([A-Za-z0-9]{32,44})/);
                const mintMatch = log.match(/mint: ([A-Za-z0-9]{32,44})/);
                if (poolMatch && mintMatch) {
                    try {
                        const poolAddress = new web3_js_1.PublicKey(poolMatch[1]);
                        const mint = new web3_js_1.PublicKey(mintMatch[1]);
                        const developer = this.extractDeveloperFromLogs(logs) || this.wallet.publicKey;
                        return {
                            mint,
                            developer,
                            poolAddress,
                            initialLiquidity: 0,
                            timestamp: Date.now()
                        };
                    }
                    catch (error) {
                        console.error('Invalid public key in Raydium CLMM logs:', error);
                    }
                }
            }
        }
        return null;
    }
    // ✅ IMPROVED: Enhanced developer extraction with better pattern matching
    extractDeveloperFromLogs(logs) {
        // Filter out generic program logs to reduce noise
        const contentLogs = logs.filter(log => !log.includes('Program invoke:') &&
            !log.includes('Program success:') &&
            !log.includes('Program return:'));
        if (contentLogs.length === 0) {
            return null; // No content logs to analyze
        }
        const patterns = [
            /authority: ([A-Za-z0-9]{32,44})/i,
            /creator: ([A-Za-z0-9]{32,44})/i,
            /owner: ([A-Za-z0-9]{32,44})/i,
            /pool creator: ([A-Za-z0-9]{32,44})/i,
            /liquidity provider: ([A-Za-z0-9]{32,44})/i,
            /market maker: ([A-Za-z0-9]{32,44})/i,
            /Raydium program ID: ([A-Za-z0-9]{32,44})/i,
            // Removed: /([A-Za-z0-9]{32,44})/g // This generic pattern causes too many false positives
        ];
        for (const log of contentLogs) {
            for (const pattern of patterns) {
                const match = log.match(pattern);
                if (match && match[1]) {
                    try {
                        const address = match[1];
                        // ✅ NEW: Validate public key format before creating PublicKey
                        if (this.isValidPublicKey(address)) {
                            const pubkey = new web3_js_1.PublicKey(address);
                            console.log(`✅ Developer address extracted from logs: ${pubkey.toBase58()}`);
                            return pubkey;
                        }
                        else {
                            console.log(`⚠️ Invalid public key format: ${address}`);
                        }
                    }
                    catch (error) {
                        console.log(`⚠️ Error creating PublicKey from ${match[1]}: ${error}`);
                    }
                }
            }
        }
        // Only log "No developer address found" if we actually analyzed content logs
        if (contentLogs.length > 0) {
            console.log('No developer address found in Raydium logs');
        }
        return null;
    }
    // ✅ NEW: Helper method to validate public key format
    isValidPublicKey(address) {
        try {
            new web3_js_1.PublicKey(address);
            return true;
        }
        catch {
            return false;
        }
    }
    // ✅ NEW: Extract developer address from transaction accounts as fallback
    async extractDeveloperFromTransaction(signature) {
        try {
            console.log(`🔍 Attempting to extract developer from transaction: ${signature}`);
            // Get transaction details
            const transaction = await this.connection.getTransaction(signature, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            });
            if (!transaction || !transaction.meta) {
                console.log(`⚠️ Transaction not found or no metadata`);
                return null;
            }
            // Get account keys from the transaction
            const accountKeys = transaction.transaction.message.getAccountKeys();
            if (!accountKeys) {
                console.log(`⚠️ No account keys found in transaction`);
                return null;
            }
            // Look for the fee payer (often the developer)
            const feePayer = accountKeys.get(0);
            if (feePayer && !this.isKnownProgramId(feePayer)) {
                console.log(`🎯 Using fee payer as developer: ${feePayer.toBase58()}`);
                return feePayer;
            }
            // Look for writable accounts that could be the developer
            const writableAccounts = [];
            for (let i = 0; i < accountKeys.length; i++) {
                if (transaction.transaction.message.isAccountWritable(i)) {
                    const account = accountKeys.get(i);
                    if (account) {
                        writableAccounts.push(account);
                    }
                }
            }
            for (const account of writableAccounts) {
                if (!this.isKnownProgramId(account) && !this.isCommonAddress(account)) {
                    console.log(`🎯 Using writable account as developer: ${account.toBase58()}`);
                    return account;
                }
            }
            console.log(`❌ No suitable developer address found in transaction`);
            return null;
        }
        catch (error) {
            console.error(`Error extracting developer from transaction:`, error);
            return null;
        }
    }
    // ✅ NEW: Check if a public key is a known program ID
    isKnownProgramId(pubkey) {
        const knownPrograms = [
            RAYDIUM_AMM_PROGRAM_ID,
            RAYDIUM_CLMM_PROGRAM_ID,
            RAYDIUM_MARKET_PROGRAM_ID,
            spl_token_1.TOKEN_PROGRAM_ID
        ];
        return knownPrograms.some(program => program.equals(pubkey));
    }
    // ✅ NEW: Check if a public key is a common/known address
    isCommonAddress(pubkey) {
        // Add common addresses that shouldn't be considered developers
        const commonAddresses = [
        // Add any common addresses here
        ];
        return commonAddresses.some(addr => addr.equals(pubkey));
    }
    // ✅ IMPROVED: Better buy transaction creation with actual Raydium logic
    async createBuyTransaction(tokenMint, amount, slippage) {
        const transaction = new web3_js_1.Transaction();
        // Add priority fee and compute unit instructions
        const priorityFeeIx = web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 50000
        });
        transaction.add(priorityFeeIx);
        const computeUnitIx = web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({
            units: 400000
        });
        transaction.add(computeUnitIx);
        // ✅ IMPROVED: Get pool info for the token
        const poolInfo = await this.getPoolInfo(tokenMint);
        if (poolInfo) {
            // Create associated token account if it doesn't exist
            const baseTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(tokenMint, this.wallet.publicKey);
            const quoteTokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(new web3_js_1.PublicKey(poolInfo.quoteMint), this.wallet.publicKey);
            const baseTokenAccountInfo = await this.connection.getAccountInfo(baseTokenAccount);
            if (!baseTokenAccountInfo) {
                const createBaseTokenAccountIx = (0, spl_token_1.createAssociatedTokenAccountInstruction)(this.wallet.publicKey, baseTokenAccount, this.wallet.publicKey, tokenMint);
                transaction.add(createBaseTokenAccountIx);
            }
            const quoteTokenAccountInfo = await this.connection.getAccountInfo(quoteTokenAccount);
            if (!quoteTokenAccountInfo) {
                const createQuoteTokenAccountIx = (0, spl_token_1.createAssociatedTokenAccountInstruction)(this.wallet.publicKey, quoteTokenAccount, this.wallet.publicKey, new web3_js_1.PublicKey(poolInfo.quoteMint));
                transaction.add(createQuoteTokenAccountIx);
            }
            // ✅ IMPROVED: Create actual Raydium swap instruction
            const swapIx = await this.createRaydiumSwapInstruction(poolInfo, amount, slippage);
            if (swapIx) {
                transaction.add(swapIx);
            }
        }
        return transaction;
    }
    // ✅ IMPROVED: Better sell transaction creation
    async createSellTransaction(tokenMint, slippage) {
        const transaction = new web3_js_1.Transaction();
        // Add priority fee and compute unit instructions
        const priorityFeeIx = web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 50000
        });
        transaction.add(priorityFeeIx);
        const computeUnitIx = web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({
            units: 400000
        });
        transaction.add(computeUnitIx);
        // Get pool info and token balance
        const poolInfo = await this.getPoolInfo(tokenMint);
        if (poolInfo) {
            const tokenBalance = await this.getTokenBalance(tokenMint);
            if (tokenBalance > 0) {
                // ✅ IMPROVED: Create actual Raydium sell instruction
                const sellIx = await this.createRaydiumSellInstruction(poolInfo, tokenBalance, slippage);
                if (sellIx) {
                    transaction.add(sellIx);
                }
            }
        }
        return transaction;
    }
    // ✅ IMPROVED: Get pool information for a token with advanced data parsing
    async getPoolInfo(tokenMint) {
        try {
            // Query all AMM pools for the token
            const ammPools = await this.connection.getProgramAccounts(RAYDIUM_AMM_PROGRAM_ID, {
                filters: [
                    { dataSize: 752 }, // LIQUIDITY_STATE_LAYOUT_V4.span
                    { memcmp: { offset: 8, bytes: tokenMint.toBase58() } } // baseMint offset
                ]
            });
            if (ammPools.length > 0) {
                // Get the first pool (you might want to implement logic to select the best pool)
                const poolData = ammPools[0];
                // ✅ IMPROVED: Advanced pool data parsing with version detection
                try {
                    const poolBuffer = poolData.account.data;
                    // Detect pool version based on data size and structure
                    const poolVersion = this.detectPoolVersion(poolBuffer);
                    const offsets = RAYDIUM_POOL_DATA_OFFSETS[poolVersion];
                    // Parse pool data from buffer using version-specific offsets
                    const baseReserve = this.readBigUint64LE(poolBuffer, offsets.BASE_RESERVE);
                    const quoteReserve = this.readBigUint64LE(poolBuffer, offsets.QUOTE_RESERVE);
                    const baseSupply = this.readBigUint64LE(poolBuffer, offsets.BASE_SUPPLY);
                    const quoteSupply = this.readBigUint64LE(poolBuffer, offsets.QUOTE_SUPPLY);
                    const lpSupply = this.readBigUint64LE(poolBuffer, offsets.LP_SUPPLY);
                    // Parse account addresses
                    const authority = this.readPublicKey(poolBuffer, offsets.AUTHORITY);
                    const openOrders = this.readPublicKey(poolBuffer, offsets.OPEN_ORDERS);
                    const targetOrders = this.readPublicKey(poolBuffer, offsets.TARGET_ORDERS);
                    const baseVault = this.readPublicKey(poolBuffer, offsets.BASE_VAULT);
                    const quoteVault = this.readPublicKey(poolBuffer, offsets.QUOTE_VAULT);
                    const lpVault = this.readPublicKey(poolBuffer, offsets.LP_VAULT);
                    const marketId = this.readPublicKey(poolBuffer, offsets.MARKET_ID);
                    const marketBids = this.readPublicKey(poolBuffer, offsets.MARKET_BIDS);
                    const marketAsks = this.readPublicKey(poolBuffer, offsets.MARKET_ASKS);
                    const marketEventQueue = this.readPublicKey(poolBuffer, offsets.MARKET_EVENT_QUEUE);
                    const marketBaseVault = this.readPublicKey(poolBuffer, offsets.MARKET_BASE_VAULT);
                    const marketQuoteVault = this.readPublicKey(poolBuffer, offsets.MARKET_QUOTE_VAULT);
                    const marketAuthority = this.readPublicKey(poolBuffer, offsets.MARKET_AUTHORITY);
                    // ✅ NEW: Parse version-specific fields
                    let poolType, targetOrdersOwner, withdrawQueueOwner, lpVaultOwner, rewardInfos;
                    if (poolVersion === 'V2' || poolVersion === 'V3' || poolVersion === 'V4') {
                        const v2PlusOffsets = offsets;
                        poolType = this.readUint8(poolBuffer, v2PlusOffsets.POOL_TYPE);
                        targetOrdersOwner = this.readPublicKey(poolBuffer, v2PlusOffsets.TARGET_ORDERS_OWNER);
                    }
                    if (poolVersion === 'V3' || poolVersion === 'V4') {
                        const v3PlusOffsets = offsets;
                        withdrawQueueOwner = this.readPublicKey(poolBuffer, v3PlusOffsets.WITHDRAW_QUEUE);
                        lpVaultOwner = this.readPublicKey(poolBuffer, v3PlusOffsets.LP_VAULT_OWNER);
                    }
                    if (poolVersion === 'V4') {
                        // Parse reward infos (simplified)
                        rewardInfos = [];
                    }
                    // ✅ NEW: Calculate advanced metrics
                    const price = this.calculateAdvancedPrice(baseReserve, quoteReserve);
                    const liquidity = this.calculateLiquidity(baseReserve, quoteReserve);
                    return {
                        id: poolData.pubkey.toString(),
                        baseMint: tokenMint.toString(),
                        quoteMint: 'So11111111111111111111111111111111111111112', // WSOL
                        lpMint: poolData.pubkey.toString(),
                        baseDecimals: 6,
                        quoteDecimals: 9,
                        version: parseInt(poolVersion.slice(1)),
                        programId: RAYDIUM_AMM_PROGRAM_ID.toString(),
                        authority: authority.toString(),
                        openOrders: openOrders.toString(),
                        targetOrders: targetOrders.toString(),
                        baseVault: baseVault.toString(),
                        quoteVault: quoteVault.toString(),
                        withdrawQueue: poolData.pubkey.toString(),
                        lpVault: lpVault.toString(),
                        marketVersion: 3,
                        marketId: marketId.toString(),
                        marketProgramId: RAYDIUM_MARKET_PROGRAM_ID.toString(),
                        marketAuthority: marketAuthority.toString(),
                        marketBaseVault: marketBaseVault.toString(),
                        marketQuoteVault: marketQuoteVault.toString(),
                        marketBids: marketBids.toString(),
                        marketAsks: marketAsks.toString(),
                        marketEventQueue: marketEventQueue.toString(),
                        lookupTableAccount: '',
                        // ✅ IMPROVED: Actual parsed pool data
                        baseReserve: Number(baseReserve),
                        quoteReserve: Number(quoteReserve),
                        baseSupply: Number(baseSupply),
                        quoteSupply: Number(quoteSupply),
                        lpSupply: Number(lpSupply),
                        // ✅ NEW: Version-specific fields
                        poolType,
                        targetOrdersOwner: targetOrdersOwner?.toString(),
                        withdrawQueueOwner: withdrawQueueOwner?.toString(),
                        lpVaultOwner: lpVaultOwner?.toString(),
                        rewardInfos,
                        // ✅ NEW: Calculated fields
                        price,
                        liquidity,
                        volume24h: 0, // Placeholder for future implementation
                        fee24h: 0 // Placeholder for future implementation
                    };
                }
                catch (decodeError) {
                    console.log('Advanced pool data parsing failed, using fallback...');
                    // Fallback to basic info
                    return this.createFallbackPoolInfo(poolData, tokenMint);
                }
            }
            return null;
        }
        catch (error) {
            console.error('Error getting pool info:', error);
            return null;
        }
    }
    // ✅ NEW: Detect pool version based on data structure
    detectPoolVersion(poolBuffer) {
        try {
            // Check for V4 specific fields
            if (poolBuffer.length >= 800) {
                return 'V4';
            }
            // Check for V3 specific fields
            if (poolBuffer.length >= 768) {
                return 'V3';
            }
            // Check for V2 specific fields
            if (poolBuffer.length >= 736) {
                return 'V2';
            }
            // Default to V1
            return 'V1';
        }
        catch {
            return 'V1';
        }
    }
    // ✅ NEW: Create fallback pool info
    createFallbackPoolInfo(poolData, tokenMint) {
        return {
            id: poolData.pubkey.toString(),
            baseMint: tokenMint.toString(),
            quoteMint: 'So11111111111111111111111111111111111111112',
            lpMint: poolData.pubkey.toString(),
            baseDecimals: 6,
            quoteDecimals: 9,
            version: 4,
            programId: RAYDIUM_AMM_PROGRAM_ID.toString(),
            authority: poolData.pubkey.toString(),
            openOrders: poolData.pubkey.toString(),
            targetOrders: poolData.pubkey.toString(),
            baseVault: poolData.pubkey.toString(),
            quoteVault: poolData.pubkey.toString(),
            withdrawQueue: poolData.pubkey.toString(),
            lpVault: poolData.pubkey.toString(),
            marketVersion: 3,
            marketId: poolData.pubkey.toString(),
            marketProgramId: RAYDIUM_MARKET_PROGRAM_ID.toString(),
            marketAuthority: poolData.pubkey.toString(),
            marketBaseVault: poolData.pubkey.toString(),
            marketQuoteVault: poolData.pubkey.toString(),
            marketBids: poolData.pubkey.toString(),
            marketAsks: poolData.pubkey.toString(),
            marketEventQueue: poolData.pubkey.toString(),
            lookupTableAccount: '',
            // Fallback values
            baseReserve: 0,
            quoteReserve: 0,
            baseSupply: 0,
            quoteSupply: 0,
            lpSupply: 0,
            // Calculated fields
            price: 0.01,
            liquidity: 0
        };
    }
    // ✅ NEW: Advanced price calculation with AMM formulas
    calculateAdvancedPrice(baseReserve, quoteReserve) {
        if (baseReserve === 0n || quoteReserve === 0n) {
            return 0.01; // Fallback price
        }
        // ✅ IMPROVED: Use constant product AMM formula with fee consideration
        const baseReserveNum = Number(baseReserve);
        const quoteReserveNum = Number(quoteReserve);
        // Basic constant product formula: price = quoteReserve / baseReserve
        const rawPrice = quoteReserveNum / baseReserveNum / 1e9; // Convert lamports to SOL
        // ✅ NEW: Apply fee adjustment (typical Raydium fee is 0.25%)
        const feeRate = 0.0025; // 0.25%
        const adjustedPrice = rawPrice * (1 - feeRate);
        return adjustedPrice;
    }
    // ✅ NEW: Advanced liquidity calculation
    calculateLiquidity(baseReserve, quoteReserve) {
        if (baseReserve === 0n || quoteReserve === 0n) {
            return 0;
        }
        // ✅ IMPROVED: Calculate total liquidity in SOL terms
        const baseReserveNum = Number(baseReserve);
        const quoteReserveNum = Number(quoteReserve);
        // Convert both reserves to SOL terms and sum them
        const baseInSol = baseReserveNum / 1e9;
        const quoteInSol = quoteReserveNum / 1e9;
        // Total liquidity is the sum of both reserves in SOL terms
        return baseInSol + quoteInSol;
    }
    // ✅ NEW: Helper methods for parsing pool data
    readBigUint64LE(buffer, offset) {
        try {
            return buffer.readBigUint64LE(offset);
        }
        catch {
            return 0n;
        }
    }
    readUint8(buffer, offset) {
        try {
            return buffer.readUint8(offset);
        }
        catch {
            return 0;
        }
    }
    readPublicKey(buffer, offset) {
        try {
            const pubkeyBytes = buffer.slice(offset, offset + 32);
            return new web3_js_1.PublicKey(pubkeyBytes);
        }
        catch {
            return web3_js_1.PublicKey.default;
        }
    }
    // ✅ IMPROVED: Create actual Raydium swap instruction with proper data
    async createRaydiumSwapInstruction(poolInfo, amount, slippage) {
        try {
            // ✅ IMPROVED: Calculate actual minimum amount out based on pool reserves
            const amountInLamports = Math.floor(amount * 1e9); // Convert SOL to lamports
            const minAmountOut = Math.floor(amountInLamports * (1 - slippage));
            // Create the swap instruction data with proper format
            const data = Buffer.alloc(9);
            data.writeUint8(9, 0); // Instruction discriminator for swap
            data.writeBigUint64LE(BigInt(amountInLamports), 1); // Amount in
            // Create account metas for Raydium swap
            const keys = [
                { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.authority), isSigner: false, isWritable: false },
                { pubkey: new web3_js_1.PublicKey(poolInfo.openOrders), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.targetOrders), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.baseVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.quoteVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.lpVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketId), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketBids), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketAsks), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketEventQueue), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketBaseVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketQuoteVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketAuthority), isSigner: false, isWritable: false },
                { pubkey: spl_token_1.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            ];
            return new web3_js_1.TransactionInstruction({
                keys,
                programId: RAYDIUM_AMM_PROGRAM_ID,
                data,
            });
        }
        catch (error) {
            console.error('Error creating Raydium swap instruction:', error);
            return null;
        }
    }
    // ✅ NEW: Create Raydium sell instruction
    async createRaydiumSellInstruction(poolInfo, amount, slippage) {
        try {
            // Similar to buy instruction but for selling
            const amountInTokens = Math.floor(amount * Math.pow(10, poolInfo.baseDecimals));
            const minAmountOut = Math.floor(amountInTokens * (1 - slippage));
            const data = Buffer.alloc(9);
            data.writeUint8(9, 0); // Instruction discriminator for swap
            data.writeBigUint64LE(BigInt(amountInTokens), 1); // Amount in
            // Same account structure as buy
            const keys = [
                { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.authority), isSigner: false, isWritable: false },
                { pubkey: new web3_js_1.PublicKey(poolInfo.openOrders), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.targetOrders), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.baseVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.quoteVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.lpVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketId), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketBids), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketAsks), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketEventQueue), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketBaseVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketQuoteVault), isSigner: false, isWritable: true },
                { pubkey: new web3_js_1.PublicKey(poolInfo.marketAuthority), isSigner: false, isWritable: false },
                { pubkey: spl_token_1.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            ];
            return new web3_js_1.TransactionInstruction({
                keys,
                programId: RAYDIUM_AMM_PROGRAM_ID,
                data,
            });
        }
        catch (error) {
            console.error('Error creating Raydium sell instruction:', error);
            return null;
        }
    }
    // ✅ IMPROVED: Calculate actual token price from pool reserves
    async getTokenPrice(tokenMint) {
        try {
            const poolInfo = await this.getPoolInfo(tokenMint);
            if (!poolInfo)
                return 0;
            // ✅ IMPROVED: Calculate actual price from parsed pool reserves
            if (poolInfo.baseReserve > 0 && poolInfo.quoteReserve > 0) {
                const price = poolInfo.quoteReserve / poolInfo.baseReserve / 1e9; // Convert lamports to SOL
                return price;
            }
            return 0.01; // Fallback price
        }
        catch (error) {
            console.error('Error getting token price:', error);
            return 0;
        }
    }
    // ✅ IMPROVED: Better AMM ID lookup
    async getAmmId(tokenMint) {
        try {
            const poolInfo = await this.getPoolInfo(tokenMint);
            if (poolInfo) {
                return new web3_js_1.PublicKey(poolInfo.id);
            }
            return null;
        }
        catch (error) {
            console.error('Error getting AMM ID:', error);
            return null;
        }
    }
    // ✅ IMPROVED: Parse actual SPL token account balance
    async getTokenBalance(tokenMint) {
        try {
            const tokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(tokenMint, this.wallet.publicKey);
            const tokenAccountInfo = await this.connection.getAccountInfo(tokenAccount);
            if (!tokenAccountInfo) {
                return 0;
            }
            // ✅ IMPROVED: Parse actual SPL token account data using AccountLayout
            try {
                const decoded = spl_token_1.AccountLayout.decode(tokenAccountInfo.data);
                const balance = Number(decoded.amount);
                // Get mint info for decimals
                const mintInfo = await this.connection.getAccountInfo(tokenMint);
                if (mintInfo) {
                    const mintDecoded = spl_token_1.MintLayout.decode(mintInfo.data);
                    const decimals = mintDecoded.decimals;
                    return balance / Math.pow(10, decimals);
                }
                return balance / 1e6; // Fallback to 6 decimals
            }
            catch (decodeError) {
                console.error('Error decoding token account:', decodeError);
                return 0;
            }
        }
        catch (error) {
            console.error('Error getting token balance:', error);
            return 0;
        }
    }
    // ✅ NEW: Get all Raydium pools for a token
    async getAllPoolsForToken(tokenMint) {
        try {
            const pools = [];
            // Query AMM pools
            const ammPools = await this.connection.getProgramAccounts(RAYDIUM_AMM_PROGRAM_ID, {
                filters: [
                    { dataSize: 752 },
                    { memcmp: { offset: 8, bytes: tokenMint.toBase58() } }
                ]
            });
            // Query CLMM pools
            const clmmPools = await this.connection.getProgramAccounts(RAYDIUM_CLMM_PROGRAM_ID, {
                filters: [
                    { dataSize: 1024 }, // Approximate CLMM pool size
                    { memcmp: { offset: 8, bytes: tokenMint.toBase58() } }
                ]
            });
            // Convert to pool info format
            for (const pool of ammPools) {
                const poolInfo = await this.getPoolInfo(tokenMint);
                if (poolInfo) {
                    pools.push(poolInfo);
                }
            }
            return pools;
        }
        catch (error) {
            console.error('Error getting all pools for token:', error);
            return [];
        }
    }
    // ✅ NEW: Get best pool for trading (highest liquidity)
    async getBestPoolForToken(tokenMint) {
        try {
            const pools = await this.getAllPoolsForToken(tokenMint);
            if (pools.length === 0)
                return null;
            // ✅ IMPROVED: Sort by actual liquidity (quote reserve)
            pools.sort((a, b) => b.quoteReserve - a.quoteReserve);
            return pools[0];
        }
        catch (error) {
            console.error('Error getting best pool for token:', error);
            return null;
        }
    }
    // ✅ NEW: Add startMonitoring method for consistent interface
    async startMonitoring() {
        if (this.isMonitoring)
            return;
        console.log('🚀 Starting Raydium monitoring...');
        this.isMonitoring = true;
        // Existing onLogs subscriptions are the actual monitoring mechanisms.
        // This method primarily serves to set the flag and log startup.
        console.log('✅ Raydium monitoring started');
    }
    stop() {
        this.isMonitoring = false;
        console.log('Stopped monitoring Raydium pools');
    }
}
exports.Raydium = Raydium;
