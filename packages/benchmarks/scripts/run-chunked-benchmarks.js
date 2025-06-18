#!/usr/bin/env node

/**
 * @fileoverview Run benchmarks in chunks to avoid memory issues
 * 
 * This script:
 * 1. Runs each benchmark suite separately
 * 2. Outputs results to individual JSON files
 * 3. Creates a timestamped directory structure
 * 4. Generates a summary file referencing all results
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Benchmark suites to run
const BENCHMARK_SUITES = [
  'overhead',
  'head-to-head', 
  'adapter-rankings',
  'real-world',
  'memory',
  'svelte-runes-real'
];

// Configuration
const CONFIG = {
  outputDir: 'dist/benchmarks',
  maxOldSpaceSize: 4096,
  disableMemoization: process.env.LATTICE_DISABLE_MEMOIZATION === 'true',
  mode: process.argv[2] || 'real' // 'raw' or 'real'
};

/**
 * Run a single benchmark suite
 */
async function runBenchmarkSuite(suite, timestamp) {
  const outputFile = `${suite}-${CONFIG.mode}.json`;
  const outputPath = path.join(projectRoot, CONFIG.outputDir, timestamp, outputFile);
  
  console.log(`\n📊 Running ${suite} benchmark...`);
  
  const env = {
    ...process.env,
    NODE_OPTIONS: `--max-old-space-size=${CONFIG.maxOldSpaceSize}`,
  };
  
  if (CONFIG.disableMemoization) {
    env.LATTICE_DISABLE_MEMOIZATION = 'true';
  }
  
  const args = [
    'vitest',
    'bench',
    '--run',
    `--outputJson=${outputPath}`,
    `src/suites/${suite}.bench.ts`
  ];
  
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, {
      cwd: projectRoot,
      env,
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${suite} benchmark completed`);
        resolve({ suite, outputFile, status: 'success' });
      } else {
        console.error(`❌ ${suite} benchmark failed with code ${code}`);
        resolve({ suite, outputFile, status: 'failed', code });
      }
    });
    
    child.on('error', (error) => {
      console.error(`❌ Error running ${suite} benchmark:`, error);
      resolve({ suite, outputFile, status: 'error', error: error.message });
    });
  });
}

/**
 * Create directory structure
 */
async function setupDirectories(timestamp) {
  const baseDir = path.join(projectRoot, CONFIG.outputDir);
  const timestampDir = path.join(baseDir, timestamp);
  
  await fs.mkdir(baseDir, { recursive: true });
  await fs.mkdir(timestampDir, { recursive: true });
  
  return timestampDir;
}

/**
 * Main execution
 */
async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  
  console.log('🚀 Starting chunked benchmark run');
  console.log(`Mode: ${CONFIG.mode}`);
  console.log(`Memoization: ${CONFIG.disableMemoization ? 'disabled' : 'enabled'}`);
  console.log(`Timestamp: ${timestamp}`);
  
  try {
    // Setup directories
    await setupDirectories(timestamp);
    
    // Run benchmarks sequentially to avoid memory issues
    const results = [];
    for (const suite of BENCHMARK_SUITES) {
      const result = await runBenchmarkSuite(suite, timestamp);
      results.push(result);
      
      // Add a small delay between suites to let GC run
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Report results
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status !== 'success').length;
    
    console.log('\n📊 Benchmark Run Complete!');
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📁 Results directory: ${path.join(CONFIG.outputDir, timestamp)}`);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}