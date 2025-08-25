#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Dependency audit script for security analysis and version locking
 */
class DependencyAuditor {
  constructor() {
    this.projectRoot = process.cwd();
    this.packageJsonPath = path.join(this.projectRoot, 'package.json');
    this.lockfilePath = path.join(this.projectRoot, 'package-lock.json');
    this.auditReportPath = path.join(this.projectRoot, 'security-audit-report.json');
    this.vulnerabilityThreshold = {
      critical: 0,
      high: 0, 
      moderate: 5,
      low: 10
    };
  }

  /**
   * Run comprehensive dependency audit
   */
  async runAudit() {
    console.log('🔍 Starting dependency security audit...\n');

    const results = {
      timestamp: new Date().toISOString(),
      status: 'passed',
      vulnerabilities: {},
      outdatedPackages: [],
      securityRecommendations: [],
      lockfileStatus: 'unknown',
      totalPackages: 0,
      auditSummary: {}
    };

    try {
      // Check if package-lock.json exists
      results.lockfileStatus = this.checkLockfileStatus();
      
      // Run npm audit
      const auditResults = await this.runNpmAudit();
      results.vulnerabilities = auditResults.vulnerabilities;
      results.auditSummary = auditResults.summary;
      
      // Check for outdated packages
      results.outdatedPackages = await this.checkOutdatedPackages();
      
      // Count total packages
      results.totalPackages = this.countTotalPackages();
      
      // Generate security recommendations
      results.securityRecommendations = this.generateRecommendations(results);
      
      // Determine overall status
      results.status = this.determineOverallStatus(results);
      
      // Save audit report
      this.saveAuditReport(results);
      
      // Display results
      this.displayResults(results);
      
      // Exit with appropriate code
      if (results.status === 'failed') {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Audit failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Check lockfile status
   */
  checkLockfileStatus() {
    if (!fs.existsSync(this.lockfilePath)) {
      console.log('⚠️  No package-lock.json found - dependencies not locked!');
      return 'missing';
    }
    
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    const lockfile = JSON.parse(fs.readFileSync(this.lockfilePath, 'utf8'));
    
    // Check if lockfile is up to date
    if (packageJson.name !== lockfile.name || packageJson.version !== lockfile.version) {
      console.log('⚠️  Package-lock.json appears outdated');
      return 'outdated';
    }
    
    console.log('✅ Package-lock.json present and current');
    return 'current';
  }

  /**
   * Run npm audit
   */
  async runNpmAudit() {
    console.log('🔍 Running npm audit...');
    
    try {
      const auditOutput = execSync('npm audit --json', { 
        encoding: 'utf8',
        cwd: this.projectRoot
      });
      
      const auditData = JSON.parse(auditOutput);
      
      console.log(`📊 Audit completed: ${auditData.metadata?.totalDependencies || 'N/A'} dependencies checked`);
      
      return {
        vulnerabilities: auditData.vulnerabilities || {},
        summary: {
          total: auditData.metadata?.vulnerabilities?.total || 0,
          critical: auditData.metadata?.vulnerabilities?.critical || 0,
          high: auditData.metadata?.vulnerabilities?.high || 0,
          moderate: auditData.metadata?.vulnerabilities?.moderate || 0,
          low: auditData.metadata?.vulnerabilities?.low || 0
        }
      };
      
    } catch (error) {
      // npm audit exits with code 1 if vulnerabilities found
      if (error.stdout) {
        try {
          const auditData = JSON.parse(error.stdout);
          return {
            vulnerabilities: auditData.vulnerabilities || {},
            summary: {
              total: auditData.metadata?.vulnerabilities?.total || 0,
              critical: auditData.metadata?.vulnerabilities?.critical || 0,
              high: auditData.metadata?.vulnerabilities?.high || 0,
              moderate: auditData.metadata?.vulnerabilities?.moderate || 0,
              low: auditData.metadata?.vulnerabilities?.low || 0
            }
          };
        } catch (parseError) {
          console.error('Failed to parse audit output:', parseError.message);
        }
      }
      
      console.error('npm audit failed:', error.message);
      throw error;
    }
  }

  /**
   * Check for outdated packages
   */
  async checkOutdatedPackages() {
    console.log('🔍 Checking for outdated packages...');
    
    try {
      const outdatedOutput = execSync('npm outdated --json', { 
        encoding: 'utf8',
        cwd: this.projectRoot
      });
      
      const outdatedData = JSON.parse(outdatedOutput);
      const outdatedList = Object.entries(outdatedData).map(([name, info]) => ({
        name,
        current: info.current,
        wanted: info.wanted,
        latest: info.latest,
        location: info.location
      }));
      
      console.log(`📦 Found ${outdatedList.length} outdated packages`);
      return outdatedList;
      
    } catch (error) {
      // npm outdated exits with code 1 if outdated packages found
      if (error.stdout) {
        try {
          const outdatedData = JSON.parse(error.stdout);
          return Object.entries(outdatedData).map(([name, info]) => ({
            name,
            current: info.current,
            wanted: info.wanted,
            latest: info.latest,
            location: info.location
          }));
        } catch (parseError) {
          console.log('No outdated packages found or failed to parse output');
        }
      }
      
      return [];
    }
  }

  /**
   * Count total packages
   */
  countTotalPackages() {
    try {
      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      const deps = Object.keys(packageJson.dependencies || {});
      const devDeps = Object.keys(packageJson.devDependencies || {});
      return deps.length + devDeps.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations(results) {
    const recommendations = [];
    
    // Lockfile recommendations
    if (results.lockfileStatus === 'missing') {
      recommendations.push({
        priority: 'critical',
        category: 'dependency-locking',
        message: 'Create package-lock.json by running "npm install"',
        action: 'npm install'
      });
    } else if (results.lockfileStatus === 'outdated') {
      recommendations.push({
        priority: 'high',
        category: 'dependency-locking',
        message: 'Update package-lock.json by running "npm install"',
        action: 'npm install'
      });
    }
    
    // Vulnerability recommendations
    if (results.auditSummary.critical > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'vulnerabilities',
        message: `${results.auditSummary.critical} critical vulnerabilities found - fix immediately`,
        action: 'npm audit fix --force'
      });
    }
    
    if (results.auditSummary.high > 0) {
      recommendations.push({
        priority: 'high',
        category: 'vulnerabilities',
        message: `${results.auditSummary.high} high severity vulnerabilities found`,
        action: 'npm audit fix'
      });
    }
    
    if (results.auditSummary.moderate > this.vulnerabilityThreshold.moderate) {
      recommendations.push({
        priority: 'medium',
        category: 'vulnerabilities',
        message: `${results.auditSummary.moderate} moderate vulnerabilities exceed threshold`,
        action: 'npm audit fix'
      });
    }
    
    // Outdated packages recommendations
    if (results.outdatedPackages.length > 10) {
      recommendations.push({
        priority: 'medium',
        category: 'maintenance',
        message: `${results.outdatedPackages.length} packages are outdated`,
        action: 'npm update'
      });
    }
    
    // Security best practices
    recommendations.push({
      priority: 'low',
      category: 'best-practices',
      message: 'Run security audit regularly (weekly recommended)',
      action: 'Schedule: npm run audit'
    });
    
    recommendations.push({
      priority: 'low',
      category: 'best-practices',
      message: 'Consider using npm ci in production for exact dependency versions',
      action: 'Use: npm ci'
    });
    
    return recommendations;
  }

  /**
   * Determine overall audit status
   */
  determineOverallStatus(results) {
    // Fail on critical or high vulnerabilities
    if (results.auditSummary.critical > this.vulnerabilityThreshold.critical ||
        results.auditSummary.high > this.vulnerabilityThreshold.high) {
      return 'failed';
    }
    
    // Fail on too many moderate vulnerabilities
    if (results.auditSummary.moderate > this.vulnerabilityThreshold.moderate) {
      return 'failed';
    }
    
    // Fail if no lockfile
    if (results.lockfileStatus === 'missing') {
      return 'failed';
    }
    
    return 'passed';
  }

  /**
   * Save audit report
   */
  saveAuditReport(results) {
    try {
      fs.writeFileSync(this.auditReportPath, JSON.stringify(results, null, 2));
      console.log(`📄 Audit report saved to ${this.auditReportPath}`);
    } catch (error) {
      console.error('Failed to save audit report:', error.message);
    }
  }

  /**
   * Display results
   */
  displayResults(results) {
    console.log('\n' + '='.repeat(60));
    console.log('🔐 DEPENDENCY SECURITY AUDIT RESULTS');
    console.log('='.repeat(60));
    
    // Overall status
    const statusIcon = results.status === 'passed' ? '✅' : '❌';
    console.log(`${statusIcon} Overall Status: ${results.status.toUpperCase()}`);
    
    // Statistics
    console.log(`\n📊 Statistics:`);
    console.log(`   Total packages: ${results.totalPackages}`);
    console.log(`   Vulnerabilities: ${results.auditSummary.total}`);
    console.log(`   Outdated packages: ${results.outdatedPackages.length}`);
    
    // Vulnerability breakdown
    if (results.auditSummary.total > 0) {
      console.log(`\n🚨 Vulnerabilities by severity:`);
      console.log(`   Critical: ${results.auditSummary.critical}`);
      console.log(`   High: ${results.auditSummary.high}`);
      console.log(`   Moderate: ${results.auditSummary.moderate}`);
      console.log(`   Low: ${results.auditSummary.low}`);
    }
    
    // Recommendations
    if (results.securityRecommendations.length > 0) {
      console.log(`\n💡 Security Recommendations:`);
      results.securityRecommendations
        .filter(rec => ['critical', 'high'].includes(rec.priority))
        .forEach(rec => {
          const icon = rec.priority === 'critical' ? '🚨' : '⚠️';
          console.log(`   ${icon} ${rec.message}`);
          console.log(`      Action: ${rec.action}`);
        });
    }
    
    // Quick fixes
    console.log(`\n🛠️  Quick fixes:`);
    console.log(`   npm audit fix          - Fix vulnerabilities automatically`);
    console.log(`   npm audit fix --force  - Fix critical vulnerabilities (may break)`);
    console.log(`   npm update             - Update outdated packages`);
    console.log(`   npm ci                 - Clean install with locked versions`);
    
    console.log('\n' + '='.repeat(60));
  }

  /**
   * Generate lockfile if missing
   */
  async generateLockfile() {
    if (!fs.existsSync(this.lockfilePath)) {
      console.log('🔒 Generating package-lock.json...');
      try {
        execSync('npm install --package-lock-only', { cwd: this.projectRoot });
        console.log('✅ Package-lock.json generated successfully');
      } catch (error) {
        console.error('❌ Failed to generate package-lock.json:', error.message);
        throw error;
      }
    }
  }
}

// Run audit if called directly
if (require.main === module) {
  const auditor = new DependencyAuditor();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--generate-lockfile')) {
    auditor.generateLockfile().then(() => {
      console.log('Lockfile generation completed');
    }).catch(error => {
      console.error('Lockfile generation failed:', error.message);
      process.exit(1);
    });
  } else {
    auditor.runAudit();
  }
}

module.exports = DependencyAuditor;