"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionAnomalyMonitor = exports.TransactionAnomalyMonitor = void 0;
const structured_logger_1 = require("./structured-logger");
const notifications_1 = require("./notifications");
const circuit_breaker_1 = require("./circuit-breaker");
/**
 * Transaction anomaly monitoring system to detect suspicious patterns
 */
class TransactionAnomalyMonitor {
    recentTransactions = [];
    patterns = [];
    maxHistorySize = 1000;
    cleanupInterval;
    constructor() {
        this.initializePatterns();
        this.startCleanupTimer();
    }
    /**
     * Initialize anomaly detection patterns
     */
    initializePatterns() {
        this.patterns = [
            {
                id: 'rapid_succession',
                name: 'Rapid Transaction Succession',
                description: 'Multiple transactions in quick succession',
                severity: 'medium',
                enabled: true,
                threshold: 5, // 5 transactions
                timeWindow: 10000 // 10 seconds
            },
            {
                id: 'large_transaction',
                name: 'Unusually Large Transaction',
                description: 'Transaction size significantly larger than normal',
                severity: 'high',
                enabled: true,
                threshold: 10 // 10x larger than average
            },
            {
                id: 'high_instruction_count',
                name: 'High Instruction Count',
                description: 'Transaction with unusually many instructions',
                severity: 'medium',
                enabled: true,
                threshold: 20 // More than 20 instructions
            },
            {
                id: 'excessive_accounts',
                name: 'Excessive Account Count',
                description: 'Transaction touching too many accounts',
                severity: 'medium',
                enabled: true,
                threshold: 30 // More than 30 accounts
            },
            {
                id: 'unusual_fee',
                name: 'Unusual Transaction Fee',
                description: 'Transaction fee significantly higher than normal',
                severity: 'medium',
                enabled: true,
                threshold: 50 // 50x higher than normal
            },
            {
                id: 'repeated_failure',
                name: 'Repeated Transaction Failures',
                description: 'Multiple failed transactions to same address',
                severity: 'high',
                enabled: true,
                threshold: 3, // 3 failures
                timeWindow: 60000 // 1 minute
            },
            {
                id: 'zero_balance_interaction',
                name: 'Zero Balance Interaction',
                description: 'Interaction with zero-balance addresses',
                severity: 'high',
                enabled: true
            },
            {
                id: 'suspicious_pattern',
                name: 'Suspicious Transaction Pattern',
                description: 'Pattern matching known drainer behavior',
                severity: 'critical',
                enabled: true
            }
        ];
        structured_logger_1.logger.info(`🔍 Initialized ${this.patterns.length} anomaly detection patterns`);
    }
    /**
     * Analyze transaction for anomalies
     */
    analyzeTransaction(transaction, metrics) {
        const transactionMetrics = {
            timestamp: Date.now(),
            size: this.getTransactionSize(transaction),
            instructionCount: transaction.instructions.length,
            accountCount: this.getAccountCount(transaction),
            fee: 0, // Will be calculated
            ...metrics
        };
        // Store for historical analysis
        this.recordTransaction(transactionMetrics);
        const triggeredPatterns = [];
        let riskScore = 0;
        const recommendations = [];
        // Run each enabled pattern
        for (const pattern of this.patterns) {
            if (!pattern.enabled)
                continue;
            const result = this.checkPattern(pattern, transactionMetrics);
            if (result.triggered) {
                triggeredPatterns.push(pattern.id);
                riskScore += this.getSeverityScore(pattern.severity);
                structured_logger_1.logger.warn(`🚨 Anomaly pattern triggered: ${pattern.name}`, {
                    patternId: pattern.id,
                    severity: pattern.severity,
                    description: pattern.description,
                    metrics: transactionMetrics
                });
                // Add recommendations based on pattern
                recommendations.push(...this.getPatternRecommendations(pattern));
                // Send notifications for high severity patterns
                if (pattern.severity === 'high' || pattern.severity === 'critical') {
                    notifications_1.notificationService.sendNotification(`Transaction anomaly detected: ${pattern.name}`, 'warning', {
                        pattern: pattern.id,
                        severity: pattern.severity,
                        riskScore,
                        metrics: transactionMetrics
                    });
                }
            }
        }
        const isAnomalous = triggeredPatterns.length > 0;
        // Trigger circuit breaker for critical anomalies
        if (riskScore >= 8 || triggeredPatterns.some(p => this.patterns.find(pat => pat.id === p)?.severity === 'critical')) {
            // Record as a failed trade to trigger circuit breaker
            circuit_breaker_1.circuitBreaker.recordTrade({
                success: false,
                tokenMint: transactionMetrics.tokenMint || 'unknown',
                amount: transactionMetrics.amount || 0,
                error: 'Transaction anomaly detected',
                timestamp: new Date(Date.now())
            });
        }
        return {
            isAnomalous,
            triggeredPatterns,
            riskScore,
            recommendations: [...new Set(recommendations)] // Remove duplicates
        };
    }
    /**
     * Check specific pattern against transaction
     */
    checkPattern(pattern, metrics) {
        switch (pattern.id) {
            case 'rapid_succession':
                return this.checkRapidSuccession(pattern, metrics);
            case 'large_transaction':
                return this.checkLargeTransaction(pattern, metrics);
            case 'high_instruction_count':
                return this.checkHighInstructionCount(pattern, metrics);
            case 'excessive_accounts':
                return this.checkExcessiveAccounts(pattern, metrics);
            case 'unusual_fee':
                return this.checkUnusualFee(pattern, metrics);
            case 'repeated_failure':
                return this.checkRepeatedFailure(pattern, metrics);
            case 'zero_balance_interaction':
                return this.checkZeroBalanceInteraction(pattern, metrics);
            case 'suspicious_pattern':
                return this.checkSuspiciousPattern(pattern, metrics);
            default:
                return { triggered: false };
        }
    }
    /**
     * Check for rapid succession pattern
     */
    checkRapidSuccession(pattern, metrics) {
        if (!pattern.threshold || !pattern.timeWindow)
            return { triggered: false };
        const recentCount = this.recentTransactions.filter(tx => tx.timestamp > (metrics.timestamp - pattern.timeWindow)).length;
        return { triggered: recentCount >= pattern.threshold };
    }
    /**
     * Check for large transaction pattern
     */
    checkLargeTransaction(pattern, metrics) {
        if (!pattern.threshold || this.recentTransactions.length < 10)
            return { triggered: false };
        const averageSize = this.recentTransactions.reduce((sum, tx) => sum + tx.size, 0) / this.recentTransactions.length;
        const threshold = averageSize * pattern.threshold;
        return { triggered: metrics.size > threshold };
    }
    /**
     * Check for high instruction count pattern
     */
    checkHighInstructionCount(pattern, metrics) {
        if (!pattern.threshold)
            return { triggered: false };
        return { triggered: metrics.instructionCount > pattern.threshold };
    }
    /**
     * Check for excessive accounts pattern
     */
    checkExcessiveAccounts(pattern, metrics) {
        if (!pattern.threshold)
            return { triggered: false };
        return { triggered: metrics.accountCount > pattern.threshold };
    }
    /**
     * Check for unusual fee pattern
     */
    checkUnusualFee(pattern, metrics) {
        if (!pattern.threshold || this.recentTransactions.length < 10 || !metrics.fee) {
            return { triggered: false };
        }
        const averageFee = this.recentTransactions
            .filter(tx => tx.fee && tx.fee > 0)
            .reduce((sum, tx) => sum + tx.fee, 0) / this.recentTransactions.length;
        const threshold = averageFee * pattern.threshold;
        return { triggered: metrics.fee > threshold };
    }
    /**
     * Check for repeated failure pattern
     */
    checkRepeatedFailure(pattern, metrics) {
        if (!pattern.threshold || !pattern.timeWindow || !metrics.toAddress) {
            return { triggered: false };
        }
        const recentFailures = this.recentTransactions.filter(tx => tx.timestamp > (metrics.timestamp - pattern.timeWindow) &&
            tx.toAddress === metrics.toAddress &&
            tx.signature && tx.signature.includes('failed')).length;
        return { triggered: recentFailures >= pattern.threshold };
    }
    /**
     * Check for zero balance interaction pattern
     */
    checkZeroBalanceInteraction(pattern, metrics) {
        // This would require balance checking - placeholder for now
        return { triggered: false };
    }
    /**
     * Check for suspicious patterns
     */
    checkSuspiciousPattern(pattern, metrics) {
        // Look for common drainer patterns
        const suspiciousIndicators = [
            metrics.instructionCount > 15 && metrics.accountCount > 25, // Complex transactions
            metrics.amount && metrics.amount < 0.001, // Dust attacks
            // Add more pattern-matching logic here
        ];
        return { triggered: suspiciousIndicators.some(indicator => indicator) };
    }
    /**
     * Get severity score
     */
    getSeverityScore(severity) {
        switch (severity) {
            case 'low': return 1;
            case 'medium': return 2;
            case 'high': return 4;
            case 'critical': return 8;
            default: return 0;
        }
    }
    /**
     * Get recommendations for pattern
     */
    getPatternRecommendations(pattern) {
        const recommendations = {
            'rapid_succession': ['Consider adding delays between transactions', 'Review transaction batching'],
            'large_transaction': ['Verify transaction amount', 'Consider splitting into smaller transactions'],
            'high_instruction_count': ['Review transaction complexity', 'Verify all instructions are necessary'],
            'excessive_accounts': ['Review account interactions', 'Verify account legitimacy'],
            'unusual_fee': ['Review fee calculation', 'Consider using recommended fees'],
            'repeated_failure': ['Check recipient address validity', 'Review transaction parameters'],
            'zero_balance_interaction': ['Verify recipient has sufficient balance', 'Check for account activation'],
            'suspicious_pattern': ['Manual review recommended', 'Consider blocking transaction']
        };
        return recommendations[pattern.id] || ['Review transaction details'];
    }
    /**
     * Record transaction in history
     */
    recordTransaction(metrics) {
        this.recentTransactions.push(metrics);
        // Keep only recent transactions
        if (this.recentTransactions.length > this.maxHistorySize) {
            this.recentTransactions = this.recentTransactions.slice(-this.maxHistorySize);
        }
    }
    /**
     * Get transaction size estimate
     */
    getTransactionSize(transaction) {
        // Rough estimate of transaction size
        let size = 64; // Base transaction size
        transaction.instructions.forEach(instruction => {
            size += 32; // Program ID
            size += instruction.keys.length * 32; // Account keys
            size += instruction.data.length; // Instruction data
        });
        return size;
    }
    /**
     * Get unique account count in transaction
     */
    getAccountCount(transaction) {
        const accounts = new Set();
        transaction.instructions.forEach(instruction => {
            accounts.add(instruction.programId.toBase58());
            instruction.keys.forEach(key => {
                accounts.add(key.pubkey.toBase58());
            });
        });
        return accounts.size;
    }
    /**
     * Start cleanup timer for old transactions
     */
    startCleanupTimer() {
        this.cleanupInterval = setInterval(() => {
            const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
            this.recentTransactions = this.recentTransactions.filter(tx => tx.timestamp > cutoff);
        }, 60 * 60 * 1000); // Cleanup every hour
    }
    /**
     * Get monitoring statistics
     */
    getStatistics() {
        const patternStats = {};
        let totalAnomalous = 0;
        let totalRiskScore = 0;
        // This would require storing anomaly results - simplified for now
        return {
            totalTransactions: this.recentTransactions.length,
            anomalousTransactions: totalAnomalous,
            averageRiskScore: totalRiskScore / (this.recentTransactions.length || 1),
            patternStats
        };
    }
    /**
     * Update pattern configuration
     */
    updatePattern(patternId, updates) {
        const pattern = this.patterns.find(p => p.id === patternId);
        if (!pattern)
            return false;
        Object.assign(pattern, updates);
        structured_logger_1.logger.info(`Updated anomaly pattern: ${patternId}`, updates);
        return true;
    }
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
exports.TransactionAnomalyMonitor = TransactionAnomalyMonitor;
// Export singleton instance
exports.transactionAnomalyMonitor = new TransactionAnomalyMonitor();
