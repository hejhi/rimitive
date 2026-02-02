#!/usr/bin/env tsx
/**
 * Production benchmark runner with JSON output for docs integration
 */

import { spawn, execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { parseArgs } from 'util';

type BenchmarkResult = {
  name: string;
  timestamp: string;
  duration_ms: number;
  formattedOutput?: string; // Formatted output from benchmark
  error?: string;
  jsonData?: MitataRawBenchmark[]; // Raw benchmark data from mitata
};

// Simplified benchmark result for docs (stripped of samples)
type BenchmarkEntry = {
  name: string;
  group?: string; // Group name from mitata group()
  time: number; // p50 in nanoseconds
  min: number;
  max: number;
  avg: number;
  p50: number;
  p75: number;
  p99: number;
  args?: Record<string, unknown>;
};

// Raw mitata output structure
type MitataRawBenchmark = {
  runs: Array<{
    name: string;
    args?: Record<string, unknown>;
    stats: {
      min: number;
      max: number;
      avg: number;
      p50: number;
      p75: number;
      p99: number;
      p999: number;
      samples?: number[];
    };
  }>;
  alias?: string;
  group?: number | null;
};

type SystemInfo = {
  node: string;
  platform: string;
  arch: string;
  cpus: number;
  memory_gb: number;
  cpu_model: string;
};

type DocsJsonOutput = {
  timestamp: string;
  commit: string;
  system: SystemInfo;
  suites: Array<{
    name: string;
    benchmarks: BenchmarkEntry[];
  }>;
};

class BenchmarkRunner {
  private readonly suitesDirs: string[];
  private readonly outputDir: string;
  private readonly timeout: number;
  private readonly commitHash: string;
  private readonly timestamp: string;
  private readonly outputDocs: boolean;
  private readonly docsDataDir: string;
  private readonly tempJsonDir: string;

  constructor(
    suitesDirs: string[] = ['./src/suites/rimitive', './src/suites/view'],
    outputDir: string = './dist',
    timeout: number = 300000, // 5 minutes
    outputDocs: boolean = false
  ) {
    this.suitesDirs = suitesDirs.map((d) => path.resolve(d));
    this.outputDir = path.resolve(outputDir);
    this.timeout = timeout;
    this.commitHash = this.getGitHash();
    this.timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, -5); // Remove milliseconds and Z
    this.outputDocs = outputDocs;
    this.docsDataDir = path.resolve('../docs/src/data');
    this.tempJsonDir = path.resolve('./dist/json-temp');
  }

  private getGitHash(): string {
    try {
      // Get the short hash (7 characters)
      return execSync('git rev-parse --short HEAD', {
        encoding: 'utf-8',
      }).trim();
    } catch {
      return 'no-git';
    }
  }

  async run(filters?: string[]): Promise<void> {
    // Ensure output directories exist
    await fs.mkdir(this.outputDir, { recursive: true });
    if (this.outputDocs) {
      await fs.mkdir(this.tempJsonDir, { recursive: true });
      await fs.mkdir(this.docsDataDir, { recursive: true });
    }

    // Find all benchmark files
    const files = await this.findBenchmarkFiles(filters);
    console.log(
      `Found ${files.length} benchmark suite${files.length !== 1 ? 's' : ''}${filters?.length ? ` matching filters` : ''}\n`
    );

    const results: BenchmarkResult[] = [];

    for (const file of files) {
      const result = await this.runBenchmark(file);
      results.push(result);

      // Save individual result immediately
      await this.saveResult(result);
    }

    // Save summary
    await this.saveSummary(results);

    // Save docs JSON if requested
    if (this.outputDocs) {
      await this.saveDocsJson(results);
    }
  }

  private async findBenchmarkFiles(filters?: string[]): Promise<string[]> {
    const allFiles: string[] = [];

    // Recursively find all benchmark files in a directory
    const findInDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            // Recurse into subdirectories (skip hidden dirs and deps)
            if (entry.name !== 'deps' && entry.name !== 'node_modules') {
              await findInDir(fullPath);
            }
          } else if (
            entry.isFile() &&
            entry.name.endsWith('.bench.ts') &&
            !entry.name.startsWith('test-')
          ) {
            allFiles.push(fullPath);
          }
        }
      } catch {
        // Directory doesn't exist, skip it
      }
    };

    // Search all suites directories
    for (const suitesDir of this.suitesDirs) {
      await findInDir(suitesDir);
    }

    // Apply filters
    return allFiles.filter((file) => {
      if (filters?.length) {
        const baseName = path.basename(file, '.bench.ts');
        // Support partial matching (e.g., "signal" matches "signal-updates")
        return filters.some((filter) => baseName.includes(filter));
      }
      return true;
    });
  }

  private async runBenchmark(filePath: string): Promise<BenchmarkResult> {
    const name = path.basename(filePath, '.bench.ts');
    const startTime = Date.now();
    const jsonOutputPath = this.outputDocs
      ? path.join(this.tempJsonDir, `${name}.json`)
      : undefined;

    console.log(`Running: ${name}`);

    try {
      const formattedOutput = await this.executeBenchmark(
        filePath,
        jsonOutputPath
      );
      const duration_ms = Date.now() - startTime;

      if (!formattedOutput.trim()) {
        throw new Error('No output received');
      }

      // Read JSON data if it was generated
      let jsonData: MitataRawBenchmark[] | undefined;
      if (jsonOutputPath) {
        try {
          const jsonContent = await fs.readFile(jsonOutputPath, 'utf-8');
          const parsed = JSON.parse(jsonContent);
          jsonData = parsed.benchmarks || parsed;
        } catch {
          // JSON parsing failed, continue without it
        }
      }

      console.log(`  ✓ Completed in ${(duration_ms / 1000).toFixed(2)}s\n`);

      return {
        name,
        timestamp: new Date().toISOString(),
        duration_ms,
        formattedOutput,
        jsonData,
      };
    } catch (error: unknown) {
      const duration_ms = Date.now() - startTime;
      console.error(`  ✗ Failed: ${(error as Error).message}\n`);

      return {
        name,
        timestamp: new Date().toISOString(),
        duration_ms,
        error: (error as Error).message,
      };
    }
  }

  private executeBenchmark(
    filePath: string,
    jsonOutputPath?: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Run benchmark and capture formatted output
      console.log(''); // Add spacing
      const outputChunks: Buffer[] = [];

      const proc = spawn('tsx', ['--expose-gc', filePath], {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          ...(jsonOutputPath ? { BENCH_JSON_OUTPUT: jsonOutputPath } : {}),
        },
        timeout: this.timeout,
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
          const errorMsg =
            code === 143
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
    const successCount = results.filter((r) => !r.error).length;
    const failedCount = results.filter((r) => r.error).length;

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
${results
  .map(
    (r) =>
      `| [${r.name}](latest-${r.name}.md) | ${(r.duration_ms / 1000).toFixed(2)}s | ${r.error ? '❌ Failed' : '✅ Success'} |`
  )
  .join('\n')}

${
  failedCount > 0
    ? `
## Errors

${results
  .filter((r) => r.error)
  .map((r) => `### ${r.name}\n\`\`\`\n${r.error}\n\`\`\``)
  .join('\n\n')}
`
    : ''
}
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
    const cpuInfo = os.cpus()[0];
    return {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: os.cpus().length,
      memory_gb: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
      cpu_model: cpuInfo?.model || 'Unknown',
    };
  }

  private async saveDocsJson(results: BenchmarkResult[]): Promise<void> {
    const system = this.getSystemInfo();

    // Process raw mitata output to extract only summary stats
    const processRawBenchmarks = (
      rawBenchmarks: MitataRawBenchmark[]
    ): BenchmarkEntry[] => {
      const entries: BenchmarkEntry[] = [];

      for (const bench of rawBenchmarks) {
        for (const run of bench.runs) {
          entries.push({
            name: run.name,
            group: bench.alias, // Group name from mitata group()
            time: run.stats.p50,
            min: run.stats.min,
            max: run.stats.max,
            avg: run.stats.avg,
            p50: run.stats.p50,
            p75: run.stats.p75,
            p99: run.stats.p99,
            args: run.args,
          });
        }
      }

      return entries;
    };

    // Categorize results by checking benchmark names
    // Signals benchmarks have names like "Rimitive - 10 signals"
    // View benchmarks have names like "append 100 to $existing existing"
    const categorizeResult = (result: BenchmarkResult): 'signals' | 'view' => {
      // Results from view/ directory will have been found there
      // We can check by looking at benchmark names - view benchmarks have specific patterns
      const benchmarks = result.jsonData || [];
      for (const bench of benchmarks) {
        for (const run of bench.runs) {
          // View benchmarks have names like "append 100 to $existing existing"
          // Signals benchmarks have names like "Rimitive - 10 signals"
          if (
            run.name.includes('Rimitive') ||
            run.name.includes('Preact') ||
            run.name.includes('Alien')
          ) {
            return 'signals';
          }
        }
      }
      return 'view';
    };

    const signalsSuites = results
      .filter((r) => !r.error && r.jsonData && categorizeResult(r) === 'signals')
      .map((r) => ({
        name: r.name,
        benchmarks: processRawBenchmarks(r.jsonData!),
      }));

    const viewSuites = results
      .filter((r) => !r.error && r.jsonData && categorizeResult(r) === 'view')
      .map((r) => ({
        name: r.name,
        benchmarks: processRawBenchmarks(r.jsonData!),
      }));

    // Save signals benchmarks
    if (signalsSuites.length > 0) {
      const signalsOutput: DocsJsonOutput = {
        timestamp: new Date().toISOString(),
        commit: this.commitHash,
        system,
        suites: signalsSuites,
      };
      const signalsJsonPath = path.join(this.docsDataDir, 'signals-benchmarks.json');
      await fs.writeFile(signalsJsonPath, JSON.stringify(signalsOutput, null, 2));
      console.log(`\nSignals benchmarks saved to: ${signalsJsonPath}`);
    }

    // Save view benchmarks
    if (viewSuites.length > 0) {
      const viewOutput: DocsJsonOutput = {
        timestamp: new Date().toISOString(),
        commit: this.commitHash,
        system,
        suites: viewSuites,
      };
      const viewJsonPath = path.join(this.docsDataDir, 'view-benchmarks.json');
      await fs.writeFile(viewJsonPath, JSON.stringify(viewOutput, null, 2));
      console.log(`\nView benchmarks saved to: ${viewJsonPath}`);
    }

    // Also save combined for backwards compatibility
    const docsOutput: DocsJsonOutput = {
      timestamp: new Date().toISOString(),
      commit: this.commitHash,
      system,
      suites: results
        .filter((r) => !r.error && r.jsonData)
        .map((r) => ({
          name: r.name,
          benchmarks: processRawBenchmarks(r.jsonData!),
        })),
    };
    const docsJsonPath = path.join(this.docsDataDir, 'benchmarks.json');
    await fs.writeFile(docsJsonPath, JSON.stringify(docsOutput, null, 2));

    // Clean up temp JSON files
    try {
      await fs.rm(this.tempJsonDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Run if executed directly
async function main() {
  // Parse command line arguments
  const { positionals, values } = parseArgs({
    options: {
      'skip-build': {
        type: 'boolean',
        default: false,
      },
      docs: {
        type: 'boolean',
        default: false,
        short: 'd',
      },
    },
    allowPositionals: true,
    args: process.argv.slice(2),
  });

  // Build if not skipping
  // For now, ignore this. Always build for safety.
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

  const runner = new BenchmarkRunner(
    ['./src/suites/rimitive', './src/suites/view'],
    './dist',
    300000,
    values.docs
  );
  // Use positionals as filters (benchmark names)
  await runner.run(positionals.length > 0 ? positionals : undefined);
}

main().catch(console.error);
