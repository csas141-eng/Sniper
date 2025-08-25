"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceFeedService = void 0;
class PriceFeedService {
    connection;
    priceCache = new Map();
    lastUpdate = 0;
    updateInterval = 30000; // 30 seconds
    constructor(connection) {
        this.connection = connection;
        this.startPriceUpdates();
    }
    // Start price monitoring
    startPriceUpdates() {
        setInterval(() => {
            this.updatePrices();
        }, this.updateInterval);
    }
    // Update prices from multiple sources
    async updatePrices() {
        try {
            console.log('🔄 Updating token prices...');
            // Get SOL price from CoinGecko
            const solPrice = await this.getSolPrice();
            if (solPrice) {
                this.priceCache.set('SOL', {
                    symbol: 'SOL',
                    price: solPrice,
                    lastUpdated: Date.now()
                });
            }
            // Get USDC price (usually $1, but let's verify)
            this.priceCache.set('USDC', {
                symbol: 'USDC',
                price: 1.0,
                lastUpdated: Date.now()
            });
            this.lastUpdate = Date.now();
            console.log(`✅ Updated ${this.priceCache.size} token prices`);
        }
        catch (error) {
            console.error('❌ Failed to update prices:', error);
        }
    }
    // Get SOL price from CoinGecko
    async getSolPrice() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.status}`);
            }
            const data = await response.json();
            return data.solana?.usd || null;
        }
        catch (error) {
            console.error('Failed to get SOL price:', error);
            return null;
        }
    }
    // Get token price by symbol
    getTokenPrice(symbol) {
        const tokenPrice = this.priceCache.get(symbol);
        if (!tokenPrice || Date.now() - tokenPrice.lastUpdated > 60000) {
            return null; // Price is stale or missing
        }
        return tokenPrice.price;
    }
    // Get SOL price
    getSolPriceCached() {
        return this.getTokenPrice('SOL') || 100; // Fallback to $100 if API fails
    }
    // Calculate USD value of token amount
    calculateUSDValue(tokenAmount, tokenDecimals, symbol) {
        const price = this.getTokenPrice(symbol);
        if (!price) {
            return 0;
        }
        const actualAmount = tokenAmount / Math.pow(10, tokenDecimals);
        return actualAmount * price;
    }
    // Get all cached prices
    getAllPrices() {
        return new Map(this.priceCache);
    }
    // Force price update
    async forceUpdate() {
        await this.updatePrices();
    }
}
exports.PriceFeedService = PriceFeedService;
// Service instance will be created by SniperBot
