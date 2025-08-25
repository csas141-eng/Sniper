"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rpcEndpointValidator = exports.RPCEndpointValidator = void 0;
const web3_js_1 = require("@solana/web3.js");
const axios_1 = __importDefault(require("axios"));
const structured_logger_1 = require("./structured-logger");
/**
 * RPC endpoint validation service to ensure secure connection to official Solana endpoints
 */
class RPCEndpointValidator {
    officialEndpoints = new Set([
        // Official Solana Labs endpoints
        'https://api.mainnet-beta.solana.com',
        'https://api.devnet.solana.com',
        'https://api.testnet.solana.com',
        // Other well-known official/trusted endpoints
        'https://solana-api.projectserum.com',
        'https://rpc.ankr.com/solana',
        'https://api.mainnet.solana.com',
        'https://ssc-dao.genesysgo.net',
        'https://solana-mainnet.g.alchemy.com/v2/',
        'https://rpc.helius.xyz',
        'https://api.metaplex.solana.com',
        // QuickNode (official partner)
        'https://endpoint.quicknode.pro/solana',
        // Syndica (official partner)
        'https://solana-mainnet.syndica.io',
        // Triton (official partner) 
        'https://api.triton.one/rpc',
        // Blockdaemon (official partner)
        'https://snd-solana-mainnet.blockdaemon.tech'
    ]);
    trustedProviders = new Set([
        'solana.com',
        'solanalabs.com',
        'projectserum.com',
        'ankr.com',
        'alchemy.com',
        'genesysgo.net',
        'helius.xyz',
        'metaplex.com',
        'quicknode.pro',
        'syndica.io',
        'triton.one',
        'blockdaemon.tech'
    ]);
    suspiciousPatterns = [
        /localhost/i,
        /127\.0\.0\.1/,
        /192\.168\./,
        /10\./,
        /\.onion/i,
        /bit\.ly/i,
        /tinyurl/i,
        /t\.co/i,
        /goo\.gl/i,
        /short/i,
        /redirect/i,
        /proxy/i,
        /mirror/i,
        /fake/i,
        /scam/i,
        /phish/i,
        /malware/i,
        /virus/i
    ];
    knownMaliciousEndpoints = new Set([
        // Add known malicious RPC endpoints here
        'https://fake-solana-rpc.com',
        'https://malicious-solana.net',
        'https://scam-rpc.io'
    ]);
    /**
     * Validate RPC endpoint
     */
    async validateEndpoint(rpcUrl) {
        structured_logger_1.logger.info(`🔍 Validating RPC endpoint: ${rpcUrl}`);
        const endpointInfo = this.analyzeEndpoint(rpcUrl);
        const warnings = [...endpointInfo.warnings];
        const recommendations = [...endpointInfo.recommendations];
        // Additional validation
        let isValid = true;
        // Check against known malicious endpoints
        if (this.knownMaliciousEndpoints.has(rpcUrl)) {
            warnings.push('Endpoint is on the malicious endpoints list');
            recommendations.push('Use an official Solana RPC endpoint instead');
            endpointInfo.riskLevel = 'high';
            isValid = false;
        }
        // Test endpoint connectivity and authenticity
        try {
            await this.testEndpointConnectivity(rpcUrl);
            await this.validateEndpointAuthenticity(rpcUrl);
        }
        catch (error) {
            warnings.push(`Endpoint validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            recommendations.push('Verify endpoint URL and connectivity');
            endpointInfo.riskLevel = 'high';
            isValid = false;
        }
        // Final risk assessment
        if (!endpointInfo.isOfficial && endpointInfo.trustScore < 5) {
            warnings.push('Using unofficial RPC endpoint with low trust score');
            recommendations.push('Consider switching to an official Solana RPC endpoint');
        }
        const result = {
            isValid,
            isOfficial: endpointInfo.isOfficial,
            riskLevel: endpointInfo.riskLevel,
            warnings,
            recommendations,
            endpointInfo
        };
        // Log result
        if (result.isValid && result.isOfficial) {
            structured_logger_1.logger.info(`✅ RPC endpoint validated successfully`, {
                url: rpcUrl,
                official: result.isOfficial,
                riskLevel: result.riskLevel
            });
        }
        else {
            structured_logger_1.logger.warn(`⚠️  RPC endpoint validation concerns`, {
                url: rpcUrl,
                official: result.isOfficial,
                riskLevel: result.riskLevel,
                warnings: result.warnings
            });
        }
        return result;
    }
    /**
     * Analyze endpoint characteristics
     */
    analyzeEndpoint(rpcUrl) {
        const url = new URL(rpcUrl);
        const hostname = url.hostname.toLowerCase();
        const warnings = [];
        const recommendations = [];
        // Check if official endpoint
        const isOfficial = this.isOfficialEndpoint(rpcUrl);
        // Calculate trust score
        let trustScore = isOfficial ? 10 : 0;
        // Check for trusted provider
        const isTrustedProvider = Array.from(this.trustedProviders).some(provider => hostname.includes(provider));
        if (isTrustedProvider) {
            trustScore += 5;
        }
        // Check for suspicious patterns
        let riskLevel = 'low';
        for (const pattern of this.suspiciousPatterns) {
            if (pattern.test(rpcUrl)) {
                warnings.push(`Suspicious pattern detected in URL: ${pattern.source}`);
                trustScore -= 3;
                riskLevel = 'high';
            }
        }
        // Check protocol security
        if (url.protocol !== 'https:' && url.protocol !== 'wss:') {
            warnings.push('Endpoint does not use secure protocol (HTTPS/WSS)');
            recommendations.push('Use HTTPS/WSS endpoints for secure communication');
            trustScore -= 2;
            riskLevel = 'medium';
        }
        // Check for localhost/private IPs
        if (hostname === 'localhost' || hostname === '127.0.0.1' ||
            hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
            warnings.push('Using local/private network endpoint');
            recommendations.push('Local endpoints should only be used for development');
            trustScore -= 1;
            if (riskLevel === 'low')
                riskLevel = 'medium';
        }
        // Check for non-standard ports
        if (url.port && !['80', '443', '8080', '8443'].includes(url.port)) {
            warnings.push(`Using non-standard port: ${url.port}`);
            trustScore -= 1;
        }
        // Determine final risk level based on trust score
        if (trustScore < 3) {
            riskLevel = 'high';
        }
        else if (trustScore < 6) {
            riskLevel = 'medium';
        }
        // Add recommendations based on risk level
        if (!isOfficial) {
            recommendations.push('Consider using official Solana RPC endpoints for better security');
        }
        if (riskLevel !== 'low') {
            recommendations.push('Review endpoint provider reputation');
            recommendations.push('Monitor for unusual behavior or performance issues');
        }
        return {
            url: rpcUrl,
            name: this.getEndpointName(rpcUrl),
            isOfficial,
            trustScore: Math.max(0, trustScore),
            riskLevel,
            warnings,
            recommendations
        };
    }
    /**
     * Check if endpoint is official
     */
    isOfficialEndpoint(rpcUrl) {
        // Direct match
        if (this.officialEndpoints.has(rpcUrl)) {
            return true;
        }
        // Pattern match for endpoints with API keys
        return Array.from(this.officialEndpoints).some(official => {
            if (official.endsWith('/')) {
                return rpcUrl.startsWith(official);
            }
            return false;
        });
    }
    /**
     * Get endpoint name/provider
     */
    getEndpointName(rpcUrl) {
        const url = new URL(rpcUrl);
        const hostname = url.hostname.toLowerCase();
        const nameMapping = {
            'api.mainnet-beta.solana.com': 'Solana Labs (Official)',
            'api.devnet.solana.com': 'Solana Labs (Official)',
            'api.testnet.solana.com': 'Solana Labs (Official)',
            'solana-api.projectserum.com': 'Project Serum (Official)',
            'rpc.ankr.com': 'Ankr',
            'ssc-dao.genesysgo.net': 'GenesysGo',
            'rpc.helius.xyz': 'Helius'
        };
        // Check exact hostname match
        if (nameMapping[hostname]) {
            return nameMapping[hostname];
        }
        // Check partial matches
        for (const [domain, name] of Object.entries(nameMapping)) {
            if (hostname.includes(domain.split('.')[0])) {
                return name;
            }
        }
        // Check trusted providers
        for (const provider of this.trustedProviders) {
            if (hostname.includes(provider)) {
                return provider.charAt(0).toUpperCase() + provider.slice(1);
            }
        }
        return 'Unknown Provider';
    }
    /**
     * Test endpoint connectivity
     */
    async testEndpointConnectivity(rpcUrl) {
        const connection = new web3_js_1.Connection(rpcUrl, 'confirmed');
        // Test with a simple RPC call
        try {
            await connection.getVersion();
        }
        catch (error) {
            throw new Error(`Endpoint connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Validate endpoint authenticity
     */
    async validateEndpointAuthenticity(rpcUrl) {
        try {
            const response = await axios_1.default.post(rpcUrl, {
                jsonrpc: '2.0',
                id: 1,
                method: 'getVersion'
            }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.data || !response.data.result) {
                throw new Error('Invalid RPC response format');
            }
            // Check for Solana-specific version info
            const version = response.data.result;
            if (!version['solana-core'] && !version['feature-set']) {
                structured_logger_1.logger.warn('Endpoint may not be a valid Solana RPC endpoint');
            }
        }
        catch (error) {
            throw new Error(`Endpoint authenticity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get recommended official endpoints
     */
    getRecommendedEndpoints() {
        return [
            {
                url: 'https://api.mainnet-beta.solana.com',
                name: 'Solana Labs (Primary)',
                description: 'Official Solana Labs RPC endpoint - most reliable and secure'
            },
            {
                url: 'https://solana-api.projectserum.com',
                name: 'Project Serum',
                description: 'Official Project Serum RPC endpoint - high performance'
            },
            {
                url: 'https://rpc.ankr.com/solana',
                name: 'Ankr',
                description: 'Trusted infrastructure provider with global coverage'
            },
            {
                url: 'https://ssc-dao.genesysgo.net',
                name: 'GenesysGo',
                description: 'Community-trusted high-performance RPC endpoint'
            }
        ];
    }
    /**
     * Add endpoint to official list (for updates)
     */
    addOfficialEndpoint(endpoint) {
        this.officialEndpoints.add(endpoint);
        structured_logger_1.logger.info(`Added official endpoint: ${endpoint}`);
    }
    /**
     * Add endpoint to malicious list
     */
    addMaliciousEndpoint(endpoint) {
        this.knownMaliciousEndpoints.add(endpoint);
        structured_logger_1.logger.warn(`Added malicious endpoint to blacklist: ${endpoint}`);
    }
    /**
     * Get endpoint security score
     */
    async getEndpointSecurityScore(rpcUrl) {
        const validation = await this.validateEndpoint(rpcUrl);
        return validation.endpointInfo.trustScore;
    }
    /**
     * Validate multiple endpoints
     */
    async validateMultipleEndpoints(endpoints) {
        const results = new Map();
        await Promise.all(endpoints.map(async (endpoint) => {
            try {
                const result = await this.validateEndpoint(endpoint);
                results.set(endpoint, result);
            }
            catch (error) {
                results.set(endpoint, {
                    isValid: false,
                    isOfficial: false,
                    riskLevel: 'high',
                    warnings: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
                    recommendations: ['Use a known secure RPC endpoint'],
                    endpointInfo: {
                        url: endpoint,
                        name: 'Unknown',
                        isOfficial: false,
                        trustScore: 0,
                        riskLevel: 'high',
                        warnings: [],
                        recommendations: []
                    }
                });
            }
        }));
        return results;
    }
}
exports.RPCEndpointValidator = RPCEndpointValidator;
// Export singleton instance
exports.rpcEndpointValidator = new RPCEndpointValidator();
