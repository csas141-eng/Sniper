"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenValidator = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const fs_1 = __importDefault(require("fs"));
// Load configuration from config.json
const loadConfig = () => {
    try {
        const configData = fs_1.default.readFileSync('./config.json', 'utf8');
        const userConfig = JSON.parse(configData);
        return {
            TOKEN_VALIDATION: {
                MIN_LIQUIDITY_USD: 10000,
                MIN_HOLDERS: 7,
                REQUIRE_NO_MINT: true,
                REQUIRE_NO_BLACKLIST: true,
                ENABLE_DEVELOPER_FILTERING: true
            }
        };
    }
    catch (error) {
        console.error('Error loading config.json, using defaults:', error);
        return {
            TOKEN_VALIDATION: {
                MIN_LIQUIDITY_USD: 10000,
                MIN_HOLDERS: 7,
                REQUIRE_NO_MINT: true,
                REQUIRE_NO_BLACKLIST: true,
                ENABLE_DEVELOPER_FILTERING: true
            }
        };
    }
};
const CONFIG = loadConfig();
class TokenValidator {
    connection;
    constructor(connection) {
        this.connection = connection;
    }
    async validateToken(tokenMint) {
        const result = {
            isValid: false,
            liquidity: 0,
            holders: 7,
            hasNoMint: false,
            hasNoBlacklist: false,
            errors: []
        };
        try {
            const mintPubkey = new web3_js_1.PublicKey(tokenMint);
            // Check NoMint authority
            const mintInfo = await (0, spl_token_1.getAccount)(this.connection, mintPubkey);
            // For now, assume no mint authority (can be enhanced with proper mint authority checking)
            result.hasNoMint = true; // Placeholder - would need to check actual mint authority
            if (!result.hasNoMint) {
                result.errors.push('Token has mint authority');
            }
            // Check NoBlacklist (simplified check)
            result.hasNoBlacklist = true; // Assume true for now, can be enhanced later
            // Check liquidity (simplified - would need price feed integration)
            result.liquidity = await this.getTokenLiquidity(tokenMint);
            if (result.liquidity < CONFIG.TOKEN_VALIDATION.MIN_LIQUIDITY_USD) {
                result.errors.push(`Insufficient liquidity: $${result.liquidity} < $${CONFIG.TOKEN_VALIDATION.MIN_LIQUIDITY_USD}`);
            }
            // Check holders (simplified - would need on-chain analysis)
            result.holders = await this.getTokenHolders(tokenMint);
            if (result.holders < CONFIG.TOKEN_VALIDATION.MIN_HOLDERS) {
                result.errors.push(`Insufficient holders: ${result.holders} < ${CONFIG.TOKEN_VALIDATION.MIN_HOLDERS}`);
            }
            // Determine if token is valid
            result.isValid = result.hasNoMint &&
                result.hasNoBlacklist &&
                result.liquidity >= CONFIG.TOKEN_VALIDATION.MIN_LIQUIDITY_USD &&
                result.holders >= CONFIG.TOKEN_VALIDATION.MIN_HOLDERS;
        }
        catch (error) {
            result.errors.push(`Validation error: ${error}`);
        }
        return result;
    }
    async getTokenLiquidity(tokenMint) {
        try {
            // Use Birdeye API for liquidity
            const res = await fetch(`https://public-api.birdeye.so/public/token/${tokenMint}/liquidity`);
            if (res.ok) {
                const data = await res.json();
                return data.liquidity_usd || 0;
            }
            return 0;
        }
        catch (error) {
            console.error(`Error getting liquidity for ${tokenMint}:`, error);
            return 0;
        }
    }
    async getTokenHolders(tokenMint) {
        try {
            // Use Birdeye API for holders
            const res = await fetch(`https://public-api.birdeye.so/public/token/${tokenMint}/holders`);
            if (res.ok) {
                const data = await res.json();
                return data.holder_count || 0;
            }
            return 0;
        }
        catch (error) {
            console.error(`Error getting holders for ${tokenMint}:`, error);
            return 0;
        }
    }
}
exports.TokenValidator = TokenValidator;
// Service instance will be created by SniperBot
