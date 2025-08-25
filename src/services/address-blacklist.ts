import * as fs from 'fs';
import * as path from 'path';
import { PublicKey } from '@solana/web3.js';
import { logger } from './structured-logger';
import { notificationService } from './notifications';

export interface BlacklistEntry {
  address: string;
  reason: string;
  dateAdded: string;
  source: 'manual' | 'automatic' | 'remote';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  reportedBy?: string;
}

export interface BlacklistData {
  version: string;
  lastUpdated: string;
  entries: BlacklistEntry[];
  metadata: {
    totalEntries: number;
    sources: string[];
    categories: string[];
  };
}

/**
 * Address blacklist system to prevent interaction with known drainer addresses
 */
export class AddressBlacklist {
  private blacklistPath: string;
  private blacklistData: BlacklistData;
  private knownDrainers: Set<string>;
  private watchInterval?: NodeJS.Timeout;

  constructor(blacklistPath: string = './data/blacklist.json') {
    this.blacklistPath = blacklistPath;
    this.knownDrainers = new Set();
    this.blacklistData = this.initializeBlacklist();
    this.loadBlacklist();
    this.startWatchingForUpdates();
  }

  /**
   * Initialize blacklist structure
   */
  private initializeBlacklist(): BlacklistData {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      entries: [],
      metadata: {
        totalEntries: 0,
        sources: ['manual', 'automatic', 'remote'],
        categories: ['drainer', 'scam', 'rug_pull', 'suspicious']
      }
    };
  }

  /**
   * Load blacklist from file
   */
  private loadBlacklist(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.blacklistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.blacklistPath)) {
        const data = fs.readFileSync(this.blacklistPath, 'utf8');
        this.blacklistData = JSON.parse(data);
        
        // Rebuild the set for fast lookups
        this.knownDrainers.clear();
        this.blacklistData.entries.forEach(entry => {
          this.knownDrainers.add(entry.address.toLowerCase());
        });
        
        logger.info(`📋 Loaded blacklist with ${this.blacklistData.entries.length} entries`);
      } else {
        // Create initial blacklist with known drainer addresses
        this.addKnownDrainers();
        this.saveBlacklist();
        logger.info('📋 Created initial blacklist');
      }
    } catch (error) {
      logger.error('Error loading blacklist', { error: error instanceof Error ? error.message : 'Unknown error' });
      this.blacklistData = this.initializeBlacklist();
    }
  }

  /**
   * Add known drainer addresses to blacklist
   */
  private addKnownDrainers(): void {
    const knownDrainers = [
      // Known drainer addresses - these are examples and should be updated with real addresses
      {
        address: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
        reason: 'Known drainer wallet',
        severity: 'critical' as const,
        description: 'Identified as draining user wallets through malicious smart contracts'
      },
      {
        address: 'DRaiNXvKgNqGJLCvQLbCJCYKKaRtc7vKcqjAuRrDtHHD',
        reason: 'Drainer contract',
        severity: 'critical' as const,
        description: 'Smart contract designed to drain tokens from user wallets'
      }
    ];

    knownDrainers.forEach(drainer => {
      this.addToBlacklist(
        drainer.address,
        drainer.reason,
        'automatic',
        drainer.severity,
        drainer.description
      );
    });
  }

  /**
   * Check if an address is blacklisted
   */
  isBlacklisted(address: string): { blacklisted: boolean; entry?: BlacklistEntry } {
    const normalizedAddress = address.toLowerCase();
    
    if (this.knownDrainers.has(normalizedAddress)) {
      const entry = this.blacklistData.entries.find(e => e.address.toLowerCase() === normalizedAddress);
      return { blacklisted: true, entry };
    }
    
    return { blacklisted: false };
  }

  /**
   * Add address to blacklist
   */
  addToBlacklist(
    address: string, 
    reason: string, 
    source: 'manual' | 'automatic' | 'remote' = 'manual',
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    description?: string,
    reportedBy?: string
  ): boolean {
    try {
      // Validate address format
      new PublicKey(address);
      
      const normalizedAddress = address.toLowerCase();
      
      // Check if already exists
      if (this.knownDrainers.has(normalizedAddress)) {
        logger.warn(`Address ${address} is already blacklisted`);
        return false;
      }

      const entry: BlacklistEntry = {
        address: address,
        reason,
        dateAdded: new Date().toISOString(),
        source,
        severity,
        description,
        reportedBy
      };

      this.blacklistData.entries.push(entry);
      this.knownDrainers.add(normalizedAddress);
      this.blacklistData.metadata.totalEntries = this.blacklistData.entries.length;
      this.blacklistData.lastUpdated = new Date().toISOString();
      
      this.saveBlacklist();
      
      logger.info(`🚫 Added address to blacklist: ${address} (${reason})`);
      
      // Send notification for critical entries
      if (severity === 'critical') {
        notificationService.sendNotification(
          `Critical address added to blacklist: ${address}`,
          'warning',
          { address, reason, severity }
        );
      }
      
      return true;
    } catch (error) {
      logger.error('Error adding address to blacklist', { 
        address, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  /**
   * Remove address from blacklist
   */
  removeFromBlacklist(address: string): boolean {
    const normalizedAddress = address.toLowerCase();
    
    const index = this.blacklistData.entries.findIndex(e => e.address.toLowerCase() === normalizedAddress);
    if (index === -1) {
      return false;
    }

    this.blacklistData.entries.splice(index, 1);
    this.knownDrainers.delete(normalizedAddress);
    this.blacklistData.metadata.totalEntries = this.blacklistData.entries.length;
    this.blacklistData.lastUpdated = new Date().toISOString();
    
    this.saveBlacklist();
    
    logger.info(`✅ Removed address from blacklist: ${address}`);
    return true;
  }

  /**
   * Save blacklist to file
   */
  private saveBlacklist(): void {
    try {
      fs.writeFileSync(this.blacklistPath, JSON.stringify(this.blacklistData, null, 2));
    } catch (error) {
      logger.error('Error saving blacklist', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Get blacklist statistics
   */
  getStatistics(): {
    totalEntries: number;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
    lastUpdated: string;
  } {
    const bySeverity = this.blacklistData.entries.reduce((acc, entry) => {
      acc[entry.severity] = (acc[entry.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bySource = this.blacklistData.entries.reduce((acc, entry) => {
      acc[entry.source] = (acc[entry.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEntries: this.blacklistData.entries.length,
      bySeverity,
      bySource,
      lastUpdated: this.blacklistData.lastUpdated
    };
  }

  /**
   * Export blacklist for sharing
   */
  exportBlacklist(): string {
    return JSON.stringify(this.blacklistData, null, 2);
  }

  /**
   * Import blacklist from external source
   */
  importBlacklist(data: string, source: 'remote' | 'manual' = 'remote'): number {
    try {
      const importedData: BlacklistData = JSON.parse(data);
      let addedCount = 0;

      importedData.entries.forEach(entry => {
        if (!this.knownDrainers.has(entry.address.toLowerCase())) {
          entry.source = source;
          entry.dateAdded = new Date().toISOString();
          this.addToBlacklist(
            entry.address,
            entry.reason,
            source,
            entry.severity,
            entry.description,
            entry.reportedBy
          );
          addedCount++;
        }
      });

      logger.info(`📥 Imported ${addedCount} new addresses from external blacklist`);
      return addedCount;
    } catch (error) {
      logger.error('Error importing blacklist', { error: error instanceof Error ? error.message : 'Unknown error' });
      return 0;
    }
  }

  /**
   * Start watching for file updates
   */
  private startWatchingForUpdates(): void {
    this.watchInterval = setInterval(() => {
      try {
        if (fs.existsSync(this.blacklistPath)) {
          const stats = fs.statSync(this.blacklistPath);
          const lastModified = stats.mtime.toISOString();
          
          if (lastModified > this.blacklistData.lastUpdated) {
            logger.info('📋 Blacklist file updated externally, reloading...');
            this.loadBlacklist();
          }
        }
      } catch (error) {
        // Silent error - file watching is optional
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop watching for updates
   */
  destroy(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
    }
  }

  /**
   * Validate multiple addresses at once
   */
  validateAddresses(addresses: string[]): { safe: string[]; blacklisted: Array<{ address: string; entry: BlacklistEntry }> } {
    const safe: string[] = [];
    const blacklisted: Array<{ address: string; entry: BlacklistEntry }> = [];

    addresses.forEach(address => {
      const result = this.isBlacklisted(address);
      if (result.blacklisted && result.entry) {
        blacklisted.push({ address, entry: result.entry });
        
        // Log blacklist hit
        logger.warn('🚫 Blacklisted address detected', {
          address,
          reason: result.entry.reason,
          severity: result.entry.severity
        });
        
        // Send notification for medium+ severity
        if (result.entry.severity !== 'low') {
          notificationService.sendNotification(
            `Blacklisted address detected: ${address}`,
            'warning',
            { address, reason: result.entry.reason, severity: result.entry.severity }
          );
        }
      } else {
        safe.push(address);
      }
    });

    return { safe, blacklisted };
  }
}

// Export singleton instance
export const addressBlacklist = new AddressBlacklist();