#!/usr/bin/env tsx
/**
 * Production benchmark runner with chunked JSON output
 */

import { spawn, execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface BenchmarkResult {
  name: string;
  timestamp: string;
  duration_ms: number;
  jsonData?: string;  // Raw JSON string from benchmark
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

  async run(filter?: string): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    // Find all benchmark files
    const files = await this.findBenchmarkFiles(filter);
    console.log(`Found ${files.length} benchmark suite${files.length !== 1 ? 's' : ''}${filter ? ` matching '${filter}'` : ''}\n`);

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

  private async findBenchmarkFiles(filter?: string): Promise<string[]> {
    const entries = await fs.readdir(this.suitesDir, { withFileTypes: true });
    return entries
      .filter(entry => {
        if (!entry.isFile() || !entry.name.endsWith('.bench.ts') || entry.name.startsWith('test-')) {
          return false;
        }
        if (filter) {
          // Check if the file name (without extension) matches the filter
          const baseName = path.basename(entry.name, '.bench.ts');
          return baseName === filter;
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
      const jsonData = await this.executeBenchmark(filePath);
      const duration_ms = Date.now() - startTime;
      
      // Validate it's actually JSON
      if (!jsonData.trim()) {
        throw new Error('No output received');
      }

      console.log(`  ✓ Completed in ${(duration_ms / 1000).toFixed(2)}s\n`);
      
      return {
        name,
        timestamp: new Date().toISOString(),
        duration_ms,
        jsonData
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
      // Run benchmark once with both formats captured
      console.log(''); // Add spacing
      const chunks: Buffer[] = [];
      
      const proc = spawn('npx', [
        'tsx',
        '--expose-gc',
        filePath
      ], {
        env: {
          ...process.env,
          BENCHMARK_FORMAT: 'both', // Signal to output both formats
          NODE_ENV: 'production'
        },
        timeout: this.timeout
      });

      // Capture stdout for JSON data
      proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      
      // Pass stderr through for formatted output
      proc.stderr.pipe(process.stderr);

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks).toString());
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
    // Save with format: <hash>-<timestamp>-<name>.json
    const fileName = `${this.commitHash}-${this.timestamp}-${result.name}.json`;
    const filePath = path.join(this.outputDir, fileName);
    
    // If we have jsonData, save it directly; otherwise save the error result
    const content = result.jsonData || JSON.stringify(result);
    await fs.writeFile(filePath, content);
    
    // Also save a "latest" symlink for convenience
    const latestPath = path.join(this.outputDir, `latest-${result.name}.json`);
    try {
      await fs.unlink(latestPath);
    } catch {
      // File doesn't exist, that's fine
    }
    await fs.symlink(fileName, latestPath);
  }

  private async saveSummary(results: BenchmarkResult[]): Promise<void> {
    const summary = {
      commit: this.commitHash,
      timestamp: new Date().toISOString(),
      system: this.getSystemInfo(),
      results: results.map(r => ({
        name: r.name,
        duration_ms: r.duration_ms,
        status: r.error ? 'failed' : 'success',
        error: r.error
      }))
    };

    const summaryFileName = `${this.commitHash}-${this.timestamp}-summary.json`;
    const summaryPath = path.join(this.outputDir, summaryFileName);
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    
    // Also save a "latest" summary
    const latestSummaryPath = path.join(this.outputDir, 'latest-summary.json');
    try {
      await fs.unlink(latestSummaryPath);
    } catch {
      // File doesn't exist, that's fine
    }
    await fs.symlink(summaryFileName, latestSummaryPath);
    
    console.log('Summary:');
    console.log(`  Total: ${results.length}`);
    console.log(`  Success: ${results.filter(r => !r.error).length}`);
    console.log(`  Failed: ${results.filter(r => r.error).length}`);
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
const runner = new BenchmarkRunner();
// Get filter from command line argument
const filter = process.argv[2];
runner.run(filter).catch(console.error);