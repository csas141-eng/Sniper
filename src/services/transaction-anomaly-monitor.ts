import { PublicKey, Transaction } from '@solana/web3.js';
import { logger } from './structured-logger';
import { notificationService } from './notifications';
import { circuitBreaker } from './circuit-breaker';

export interface TransactionPattern {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  threshold?: number;
  timeWindow?: number; // in milliseconds
}

export interface AnomalyResult {
  isAnomalous: boolean;
  triggeredPatterns: string[];
  riskScore: number;
  recommendations: string[];
}

export interface TransactionMetrics {
  timestamp: number;
  size: number;
  instructionCount: number;
  accountCount: number;
  fee: number;
  signature?: string;
  fromAddress?: string;
  toAddress?: string;
  amount?: number;
  tokenMint?: string;
}

/**
 * Transaction anomaly monitoring system to detect suspicious patterns
 */
export class TransactionAnomalyMonitor {
  private recentTransactions: TransactionMetrics[] = [];
  private patterns: TransactionPattern[] = [];
  private maxHistorySize: number = 1000;
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.initializePatterns();
    this.startCleanupTimer();
  }

  /**
   * Initialize anomaly detection patterns
   */
  private initializePatterns(): void {
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

    logger.info(`🔍 Initialized ${this.patterns.length} anomaly detection patterns`);
  }

  /**
   * Analyze transaction for anomalies
   */
  analyzeTransaction(
    transaction: Transaction,
    metrics?: Partial<TransactionMetrics>
  ): AnomalyResult {
    const transactionMetrics: TransactionMetrics = {
      timestamp: Date.now(),
      size: this.getTransactionSize(transaction),
      instructionCount: transaction.instructions.length,
      accountCount: this.getAccountCount(transaction),
      fee: 0, // Will be calculated
      ...metrics
    };

    // Store for historical analysis
    this.recordTransaction(transactionMetrics);

    const triggeredPatterns: string[] = [];
    let riskScore = 0;
    const recommendations: string[] = [];

    // Run each enabled pattern
    for (const pattern of this.patterns) {
      if (!pattern.enabled) continue;

      const result = this.checkPattern(pattern, transactionMetrics);
      if (result.triggered) {
        triggeredPatterns.push(pattern.id);
        riskScore += this.getSeverityScore(pattern.severity);
        
        logger.warn(`🚨 Anomaly pattern triggered: ${pattern.name}`, {
          patternId: pattern.id,
          severity: pattern.severity,
          description: pattern.description,
          metrics: transactionMetrics
        });

        // Add recommendations based on pattern
        recommendations.push(...this.getPatternRecommendations(pattern));
        
        // Send notifications for high severity patterns
        if (pattern.severity === 'high' || pattern.severity === 'critical') {
          notificationService.sendNotification(
            `Transaction anomaly detected: ${pattern.name}`,
            'warning',
            {
              pattern: pattern.id,
              severity: pattern.severity,
              riskScore,
              metrics: transactionMetrics
            }
          );
        }
      }
    }

    const isAnomalous = triggeredPatterns.length > 0;
    
    // Trigger circuit breaker for critical anomalies
    if (riskScore >= 8 || triggeredPatterns.some(p => this.patterns.find(pat => pat.id === p)?.severity === 'critical')) {
      // Record as a failed trade to trigger circuit breaker
      circuitBreaker.recordTrade({
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
  private checkPattern(
    pattern: TransactionPattern, 
    metrics: TransactionMetrics
  ): { triggered: boolean; details?: any } {
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
  private checkRapidSuccession(pattern: TransactionPattern, metrics: TransactionMetrics): { triggered: boolean } {
    if (!pattern.threshold || !pattern.timeWindow) return { triggered: false };
    
    const recentCount = this.recentTransactions.filter(tx => 
      tx.timestamp > (metrics.timestamp - pattern.timeWindow!)
    ).length;
    
    return { triggered: recentCount >= pattern.threshold };
  }

  /**
   * Check for large transaction pattern
   */
  private checkLargeTransaction(pattern: TransactionPattern, metrics: TransactionMetrics): { triggered: boolean } {
    if (!pattern.threshold || this.recentTransactions.length < 10) return { triggered: false };
    
    const averageSize = this.recentTransactions.reduce((sum, tx) => sum + tx.size, 0) / this.recentTransactions.length;
    const threshold = averageSize * pattern.threshold;
    
    return { triggered: metrics.size > threshold };
  }

  /**
   * Check for high instruction count pattern
   */
  private checkHighInstructionCount(pattern: TransactionPattern, metrics: TransactionMetrics): { triggered: boolean } {
    if (!pattern.threshold) return { triggered: false };
    
    return { triggered: metrics.instructionCount > pattern.threshold };
  }

  /**
   * Check for excessive accounts pattern
   */
  private checkExcessiveAccounts(pattern: TransactionPattern, metrics: TransactionMetrics): { triggered: boolean } {
    if (!pattern.threshold) return { triggered: false };
    
    return { triggered: metrics.accountCount > pattern.threshold };
  }

  /**
   * Check for unusual fee pattern
   */
  private checkUnusualFee(pattern: TransactionPattern, metrics: TransactionMetrics): { triggered: boolean } {
    if (!pattern.threshold || this.recentTransactions.length < 10 || !metrics.fee) {
      return { triggered: false };
    }
    
    const averageFee = this.recentTransactions
      .filter(tx => tx.fee && tx.fee > 0)
      .reduce((sum, tx) => sum + tx.fee!, 0) / this.recentTransactions.length;
      
    const threshold = averageFee * pattern.threshold;
    
    return { triggered: metrics.fee > threshold };
  }

  /**
   * Check for repeated failure pattern
   */
  private checkRepeatedFailure(pattern: TransactionPattern, metrics: TransactionMetrics): { triggered: boolean } {
    if (!pattern.threshold || !pattern.timeWindow || !metrics.toAddress) {
      return { triggered: false };
    }
    
    const recentFailures = this.recentTransactions.filter(tx => 
      tx.timestamp > (metrics.timestamp - pattern.timeWindow!) &&
      tx.toAddress === metrics.toAddress &&
      tx.signature && tx.signature.includes('failed')
    ).length;
    
    return { triggered: recentFailures >= pattern.threshold };
  }

  /**
   * Check for zero balance interaction pattern
   */
  private checkZeroBalanceInteraction(pattern: TransactionPattern, metrics: TransactionMetrics): { triggered: boolean } {
    // This would require balance checking - placeholder for now
    return { triggered: false };
  }

  /**
   * Check for suspicious patterns
   */
  private checkSuspiciousPattern(pattern: TransactionPattern, metrics: TransactionMetrics): { triggered: boolean } {
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
  private getSeverityScore(severity: string): number {
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
  private getPatternRecommendations(pattern: TransactionPattern): string[] {
    const recommendations: Record<string, string[]> = {
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
  private recordTransaction(metrics: TransactionMetrics): void {
    this.recentTransactions.push(metrics);
    
    // Keep only recent transactions
    if (this.recentTransactions.length > this.maxHistorySize) {
      this.recentTransactions = this.recentTransactions.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get transaction size estimate
   */
  private getTransactionSize(transaction: Transaction): number {
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
  private getAccountCount(transaction: Transaction): number {
    const accounts = new Set<string>();
    
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
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      this.recentTransactions = this.recentTransactions.filter(tx => tx.timestamp > cutoff);
    }, 60 * 60 * 1000); // Cleanup every hour
  }

  /**
   * Get monitoring statistics
   */
  getStatistics(): {
    totalTransactions: number;
    anomalousTransactions: number;
    averageRiskScore: number;
    patternStats: Record<string, number>;
  } {
    const patternStats: Record<string, number> = {};
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
  updatePattern(patternId: string, updates: Partial<TransactionPattern>): boolean {
    const pattern = this.patterns.find(p => p.id === patternId);
    if (!pattern) return false;

    Object.assign(pattern, updates);
    logger.info(`Updated anomaly pattern: ${patternId}`, updates);
    return true;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export singleton instance
export const transactionAnomalyMonitor = new TransactionAnomalyMonitor();