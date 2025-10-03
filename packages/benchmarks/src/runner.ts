#!/usr/bin/env tsx
/**
 * Production benchmark runner with chunked JSON output
 */

import { spawn, execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { parseArgs } from 'util';

interface BenchmarkResult {
  name: string;
  timestamp: string;
  duration_ms: number;
  formattedOutput?: string;  // Formatted output from benchmark
  error?: string;
}

interface SystemInfo {
  node: string;
  platform: string;
  arch: string;
  cpus: number;
  memory_gb: number;
}

class BenchmarkRunner {
  private readonly suitesDir: string;
  private readonly outputDir: string;
  private readonly timeout: number;
  private readonly commitHash: string;
  private readonly timestamp: string;

  constructor(
    suitesDir: string = './src/suites/lattice',
    outputDir: string = './dist',
    timeout: number = 300000 // 5 minutes
  ) {
    this.suitesDir = path.resolve(suitesDir);
    this.outputDir = path.resolve(outputDir);
    this.timeout = timeout;
    this.commitHash = this.getGitHash();
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Remove milliseconds and Z
  }

  private getGitHash(): string {
    try {
      // Get the short hash (7 characters)
      return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      return 'no-git';
    }
  }

  async run(filters?: string[]): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    // Find all benchmark files
    const files = await this.findBenchmarkFiles(filters);
    console.log(`Found ${files.length} benchmark suite${files.length !== 1 ? 's' : ''}${filters?.length ? ` matching filters` : ''}\n`);

    const results: BenchmarkResult[] = [];
    
    for (const file of files) {
      const result = await this.runBenchmark(file);
      results.push(result);
      
      // Save individual result immediately
      await this.saveResult(result);
    }

    // Save summary
    await this.saveSummary(results);
  }

  private async findBenchmarkFiles(filters?: string[]): Promise<string[]> {
    const entries = await fs.readdir(this.suitesDir, { withFileTypes: true });
    return entries
      .filter(entry => {
        if (!entry.isFile() || !entry.name.endsWith('.bench.ts') || entry.name.startsWith('test-')) {
          return false;
        }
        if (filters?.length) {
          // Check if the file name (without extension) matches any of the filters
          const baseName = path.basename(entry.name, '.bench.ts');
          // Support partial matching (e.g., "signal" matches "signal-updates")
          return filters.some(filter => baseName.includes(filter));
        }
        return true;
      })
      .map(entry => path.join(this.suitesDir, entry.name));
  }

  private async runBenchmark(filePath: string): Promise<BenchmarkResult> {
    const name = path.basename(filePath, '.bench.ts');
    const startTime = Date.now();
    
    console.log(`Running: ${name}`);

    try {
      const formattedOutput = await this.executeBenchmark(filePath);
      const duration_ms = Date.now() - startTime;
      
      if (!formattedOutput.trim()) {
        throw new Error('No output received');
      }

      console.log(`  ✓ Completed in ${(duration_ms / 1000).toFixed(2)}s\n`);
      
      return {
        name,
        timestamp: new Date().toISOString(),
        duration_ms,
        formattedOutput
      };
    } catch (error: unknown) {
      const duration_ms = Date.now() - startTime;
      console.error(`  ✗ Failed: ${(error as Error).message}\n`);
      
      return {
        name,
        timestamp: new Date().toISOString(),
        duration_ms,
        error: (error as Error).message
      };
    }
  }

  private executeBenchmark(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Run benchmark and capture formatted output
      console.log(''); // Add spacing
      const outputChunks: Buffer[] = [];
      
      const proc = spawn('npx', [
        'tsx',
        '--expose-gc',
        filePath
      ], {
        env: {
          ...process.env,
          NODE_ENV: 'production'
        },
        timeout: this.timeout
      });

      // Capture both stdout and stderr for formatted output
      proc.stdout.on('data', (chunk: Buffer) => {
        outputChunks.push(chunk);
        process.stdout.write(chunk); // Pass through to console
      });
      
      proc.stderr.on('data', (chunk: Buffer) => {
        outputChunks.push(chunk);
        process.stderr.write(chunk); // Pass through to console
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(outputChunks).toString());
        } else {
          const errorMsg = code === 143 
            ? `Process timed out after ${this.timeout / 1000}s (SIGTERM)`
            : `Process exited with code ${code}`;
          reject(new Error(errorMsg));
        }
      });

      proc.on('error', reject);
    });
  }


  private async saveResult(result: BenchmarkResult): Promise<void> {
    // Save with format: <hash>-<timestamp>-<name>.md
    const fileName = `${this.commitHash}-${this.timestamp}-${result.name}.md`;
    const filePath = path.join(this.outputDir, fileName);
    
    // Convert ANSI escape codes to markdown-friendly format
    const cleanOutput = this.cleanAnsiCodes(result.formattedOutput || '');
    
    // Create markdown content with metadata
    const mdContent = `# Benchmark: ${result.name}

**Date:** ${result.timestamp}  
**Commit:** ${this.commitHash}  
**Duration:** ${(result.duration_ms / 1000).toFixed(2)}s  
${result.error ? `**Status:** ❌ Failed - ${result.error}` : '**Status:** ✅ Success'}

## Results

\`\`\`
${cleanOutput}
\`\`\`
`;
    
    await fs.writeFile(filePath, mdContent);
    
    // Also save a "latest" symlink for convenience
    const latestPath = path.join(this.outputDir, `latest-${result.name}.md`);
    try {
      await fs.unlink(latestPath);
    } catch {
      // File doesn't exist, that's fine
    }
    await fs.symlink(fileName, latestPath);
  }

  private cleanAnsiCodes(text: string): string {
    // Remove ANSI escape sequences
    return text.replace(/\\x1b\[[0-9;]*m/g, '');
  }

  private async saveSummary(results: BenchmarkResult[]): Promise<void> {
    const system = this.getSystemInfo();
    const successCount = results.filter(r => !r.error).length;
    const failedCount = results.filter(r => r.error).length;
    
    // Create markdown summary
    const summaryContent = `# Benchmark Summary

**Date:** ${new Date().toISOString()}  
**Commit:** ${this.commitHash}  

## System Info
- **Node:** ${system.node}
- **Platform:** ${system.platform}
- **Architecture:** ${system.arch}
- **CPUs:** ${system.cpus}
- **Memory:** ${system.memory_gb} GB

## Results Overview
- **Total:** ${results.length}
- **Success:** ${successCount} ✅
- **Failed:** ${failedCount} ${failedCount > 0 ? '❌' : ''}

## Individual Results

| Benchmark | Duration | Status |
|-----------|----------|--------|
${results.map(r => 
  `| [${r.name}](latest-${r.name}.md) | ${(r.duration_ms / 1000).toFixed(2)}s | ${r.error ? '❌ Failed' : '✅ Success'} |`
).join('\n')}

${failedCount > 0 ? `
## Errors

${results.filter(r => r.error).map(r => 
  `### ${r.name}\n\`\`\`\n${r.error}\n\`\`\``
).join('\n\n')}
` : ''}
`;

    const summaryFileName = `${this.commitHash}-${this.timestamp}-summary.md`;
    const summaryPath = path.join(this.outputDir, summaryFileName);
    await fs.writeFile(summaryPath, summaryContent);
    
    // Also save a "latest" summary
    const latestSummaryPath = path.join(this.outputDir, 'latest-summary.md');
    try {
      await fs.unlink(latestSummaryPath);
    } catch {
      // File doesn't exist, that's fine
    }
    await fs.symlink(summaryFileName, latestSummaryPath);
    
    console.log('Summary:');
    console.log(`  Total: ${results.length}`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Failed: ${failedCount}`);
    console.log(`\nResults saved to: ${this.outputDir}`);
  }

  private getSystemInfo(): SystemInfo {
    return {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: os.cpus().length,
      memory_gb: Math.round(os.totalmem() / (1024 * 1024 * 1024))
    };
  }
}

// Run if executed directly
async function main() {
  // Parse command line arguments
  const { positionals } = parseArgs({
    options: {
      'skip-build': {
        type: 'boolean',
        default: false,
      },
    },
    allowPositionals: true,
    args: process.argv.slice(2),
  });

  // Build if not skipping
  // For now, igore this. Always build for safety.
  // if (!values['skip-build']) {
    console.log('Building packages...');
    try {
      execSync('pnpm build', { 
        stdio: 'inherit',
        cwd: path.resolve('./'),
      });
      console.log('Build complete.\n');
    } catch (error) {
      console.error('Build failed:', error);
      process.exit(1);
    }
  // }

  const runner = new BenchmarkRunner();
  // Use positionals as filters (benchmark names)
  await runner.run(positionals.length > 0 ? positionals : undefined);
}

main().catch(console.error);