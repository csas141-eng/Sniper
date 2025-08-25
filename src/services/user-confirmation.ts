import * as readline from 'readline';
import { logger } from './structured-logger';
import { notificationService } from './notifications';

export interface ConfirmationRequest {
  id: string;
  action: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  details: any;
  timestamp: number;
  timeout?: number;
}

export interface ConfirmationResponse {
  confirmed: boolean;
  reason?: string;
  timestamp: number;
  userInput?: string;
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  recommendations: string[];
  autoConfirm: boolean;
}

/**
 * User confirmation system for risky trading actions
 */
export class UserConfirmationService {
  private pendingConfirmations: Map<string, ConfirmationRequest> = new Map();
  private confirmationHistory: Array<{ request: ConfirmationRequest; response: ConfirmationResponse }> = [];
  private autoConfirmThresholds: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
    trade: 'low',
    largeTrade: 'medium',
    suspiciousToken: 'high',
    blacklistedAddress: 'critical'
  };

  constructor() {
    this.startTimeoutChecker();
  }

  /**
   * Request user confirmation for risky action
   */
  async requestConfirmation(
    action: string,
    details: any,
    riskAssessment?: RiskAssessment,
    timeout: number = 30000
  ): Promise<ConfirmationResponse> {
    const request: ConfirmationRequest = {
      id: this.generateId(),
      action,
      riskLevel: riskAssessment?.riskLevel || this.assessRisk(action, details).riskLevel,
      details,
      timestamp: Date.now(),
      timeout
    };

    logger.info(`🚨 Confirmation requested for ${action}`, {
      id: request.id,
      riskLevel: request.riskLevel,
      details
    });

    // Check if auto-confirmation is allowed
    if (this.shouldAutoConfirm(request)) {
      const response: ConfirmationResponse = {
        confirmed: true,
        reason: 'Auto-confirmed (low risk)',
        timestamp: Date.now()
      };

      this.recordConfirmation(request, response);
      return response;
    }

    // Store pending request
    this.pendingConfirmations.set(request.id, request);

    // Send notification
    await this.sendConfirmationNotification(request);

    // Wait for user input
    try {
      const response = await this.waitForUserInput(request);
      this.recordConfirmation(request, response);
      return response;
    } catch (error) {
      const response: ConfirmationResponse = {
        confirmed: false,
        reason: `Confirmation timeout or error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };

      this.recordConfirmation(request, response);
      return response;
    } finally {
      this.pendingConfirmations.delete(request.id);
    }
  }

  /**
   * Assess risk level for action
   */
  private assessRisk(action: string, details: any): RiskAssessment {
    const factors: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Assess based on action type
    switch (action) {
      case 'snipe_token':
        if (details.amount > 1) {
          factors.push('Large trade amount');
          riskLevel = 'medium';
        }
        if (details.newToken) {
          factors.push('New/unknown token');
          riskLevel = 'medium';
        }
        if (details.blacklisted) {
          factors.push('Blacklisted address involved');
          riskLevel = 'critical';
        }
        break;

      case 'emergency_sell':
        factors.push('Emergency sell operation');
        riskLevel = 'high';
        recommendations.push('Verify market conditions before proceeding');
        break;

      case 'bulk_operation':
        if (details.count > 10) {
          factors.push('Large number of operations');
          riskLevel = 'medium';
        }
        break;

      case 'wallet_interaction':
        if (details.newWallet) {
          factors.push('New wallet interaction');
          riskLevel = 'medium';
        }
        break;

      default:
        riskLevel = 'low';
    }

    // Additional risk factors
    if (details.suspiciousPattern) {
      factors.push('Suspicious transaction pattern detected');
      riskLevel = 'high';
    }

    if (details.zeroBalance) {
      factors.push('Zero balance issuer');
      riskLevel = 'high';
    }

    if (details.anomalyScore > 5) {
      factors.push('High anomaly score');
      riskLevel = 'medium';
    }

    // Default recommendations
    if (riskLevel !== 'low') {
      recommendations.push('Review all details carefully');
      recommendations.push('Consider reducing trade size');
    }

    return {
      riskLevel,
      factors,
      recommendations,
      autoConfirm: riskLevel === 'low'
    };
  }

  /**
   * Check if action should be auto-confirmed
   */
  private shouldAutoConfirm(request: ConfirmationRequest): boolean {
    const threshold = this.autoConfirmThresholds[request.action] || 'low';
    const levels = ['low', 'medium', 'high', 'critical'];
    
    const requestLevel = levels.indexOf(request.riskLevel);
    const thresholdLevel = levels.indexOf(threshold);
    
    return requestLevel <= thresholdLevel;
  }

  /**
   * Wait for user input
   */
  private async waitForUserInput(request: ConfirmationRequest): Promise<ConfirmationResponse> {
    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        rl.close();
        reject(new Error('Confirmation timeout'));
      }, request.timeout || 30000);

      // Display confirmation prompt
      this.displayConfirmationPrompt(request);

      rl.question('\nConfirm action? (yes/no/details): ', (answer) => {
        clearTimeout(timeoutId);
        rl.close();

        const normalizedAnswer = answer.toLowerCase().trim();
        
        if (normalizedAnswer === 'details') {
          this.displayDetailedInfo(request);
          // Restart the confirmation process
          this.waitForUserInput(request).then(resolve).catch(reject);
          return;
        }

        const confirmed = ['yes', 'y', 'confirm', 'proceed'].includes(normalizedAnswer);
        
        resolve({
          confirmed,
          reason: confirmed ? 'User confirmed' : 'User rejected',
          timestamp: Date.now(),
          userInput: answer
        });
      });
    });
  }

  /**
   * Display confirmation prompt
   */
  private displayConfirmationPrompt(request: ConfirmationRequest): void {
    console.log('\n' + '='.repeat(60));
    console.log(`🚨 CONFIRMATION REQUIRED - ${request.riskLevel.toUpperCase()} RISK`);
    console.log('='.repeat(60));
    console.log(`Action: ${request.action}`);
    console.log(`Risk Level: ${this.getRiskLevelDisplay(request.riskLevel)}`);
    console.log(`Time: ${new Date(request.timestamp).toLocaleString()}`);
    
    // Display key details
    if (request.details) {
      console.log('\nDetails:');
      this.displayDetails(request.details);
    }
    
    console.log('\nOptions:');
    console.log('  yes/y      - Proceed with action');
    console.log('  no/n       - Cancel action');
    console.log('  details    - Show detailed information');
    console.log(`\nTimeout: ${(request.timeout || 30000) / 1000} seconds`);
  }

  /**
   * Display detailed information
   */
  private displayDetailedInfo(request: ConfirmationRequest): void {
    console.log('\n' + '='.repeat(60));
    console.log('DETAILED INFORMATION');
    console.log('='.repeat(60));
    
    const riskAssessment = this.assessRisk(request.action, request.details);
    
    console.log('\nRisk Factors:');
    riskAssessment.factors.forEach(factor => {
      console.log(`  ⚠️  ${factor}`);
    });
    
    console.log('\nRecommendations:');
    riskAssessment.recommendations.forEach(rec => {
      console.log(`  💡 ${rec}`);
    });
    
    console.log('\nFull Details:');
    console.log(JSON.stringify(request.details, null, 2));
  }

  /**
   * Display details in user-friendly format
   */
  private displayDetails(details: any): void {
    const important = ['amount', 'tokenMint', 'recipient', 'riskScore', 'anomalyPatterns'];
    
    important.forEach(key => {
      if (details[key] !== undefined) {
        console.log(`  ${key}: ${details[key]}`);
      }
    });
  }

  /**
   * Get risk level display
   */
  private getRiskLevelDisplay(level: string): string {
    const displays = {
      low: '🟢 LOW',
      medium: '🟡 MEDIUM',
      high: '🔴 HIGH',
      critical: '🚨 CRITICAL'
    };
    return displays[level as keyof typeof displays] || level.toUpperCase();
  }

  /**
   * Send confirmation notification
   */
  private async sendConfirmationNotification(request: ConfirmationRequest): Promise<void> {
    if (request.riskLevel === 'high' || request.riskLevel === 'critical') {
      await notificationService.sendNotification(
        `${request.riskLevel.toUpperCase()} risk action requires confirmation: ${request.action}`,
        'warning',
        {
          id: request.id,
          action: request.action,
          riskLevel: request.riskLevel,
          details: request.details
        }
      );
    }
  }

  /**
   * Record confirmation in history
   */
  private recordConfirmation(request: ConfirmationRequest, response: ConfirmationResponse): void {
    this.confirmationHistory.push({ request, response });
    
    // Keep only recent history
    if (this.confirmationHistory.length > 1000) {
      this.confirmationHistory = this.confirmationHistory.slice(-1000);
    }

    logger.info('Confirmation recorded', {
      id: request.id,
      action: request.action,
      confirmed: response.confirmed,
      reason: response.reason
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `conf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start timeout checker
   */
  private startTimeoutChecker(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [id, request] of this.pendingConfirmations.entries()) {
        if (request.timeout && (now - request.timestamp) > request.timeout) {
          logger.warn(`Confirmation timeout for ${request.action}`, { id });
          this.pendingConfirmations.delete(id);
        }
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Update auto-confirm threshold for action type
   */
  updateAutoConfirmThreshold(action: string, threshold: 'low' | 'medium' | 'high' | 'critical'): void {
    this.autoConfirmThresholds[action] = threshold;
    logger.info(`Updated auto-confirm threshold for ${action}: ${threshold}`);
  }

  /**
   * Get confirmation statistics
   */
  getStatistics(): {
    total: number;
    confirmed: number;
    rejected: number;
    autoConfirmed: number;
    byRiskLevel: Record<string, number>;
  } {
    const stats = {
      total: this.confirmationHistory.length,
      confirmed: 0,
      rejected: 0,
      autoConfirmed: 0,
      byRiskLevel: {} as Record<string, number>
    };

    this.confirmationHistory.forEach(({ request, response }) => {
      if (response.confirmed) {
        stats.confirmed++;
        if (response.reason?.includes('Auto-confirmed')) {
          stats.autoConfirmed++;
        }
      } else {
        stats.rejected++;
      }

      stats.byRiskLevel[request.riskLevel] = (stats.byRiskLevel[request.riskLevel] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get pending confirmations
   */
  getPendingConfirmations(): ConfirmationRequest[] {
    return Array.from(this.pendingConfirmations.values());
  }
}

// Export singleton instance
export const userConfirmationService = new UserConfirmationService();