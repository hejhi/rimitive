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
const BENCHMARK_SUITES = {
  lattice: [
    'overhead',
    'adapter-rankings',
    'real-world',
    'memory',
    'svelte-runes'
  ],
  'store-react': [
    'test',
    // 'context-vs-store',
    // 'core-performance',
    'react-integration',
    // 'real-world',
    // 'scalability',
    // 'store-react-apis'
  ]
};

// Configuration
const CONFIG = {
  outputDir: 'dist/benchmarks',
  maxOldSpaceSize: 4096,
  disableMemoization: process.env.LATTICE_DISABLE_MEMOIZATION === 'true',
  mode: process.argv[2] || 'real', // 'raw' or 'real'
  suite: process.argv[3] || 'lattice' // 'lattice' or 'store-react'
};

/**
 * Run a single benchmark suite
 */
async function runBenchmarkSuite(suiteName, category, timestamp) {
  const outputFile = `${suiteName}-${CONFIG.mode}.json`;
  const outputPath = path.join(projectRoot, CONFIG.outputDir, timestamp, outputFile);
  
  console.log(`\n📊 Running ${suiteName} benchmark...`);
  
  const env = {
    ...process.env,
    NODE_OPTIONS: `--max-old-space-size=${CONFIG.maxOldSpaceSize}`,
  };
  
  if (CONFIG.disableMemoization) {
    env.LATTICE_DISABLE_MEMOIZATION = 'true';
  }
  
  // Determine file extension based on suite name
  const isReactFile = ['context-vs-store', 'react-integration', 'real-world', 'core-performance', 'store-react-apis'].includes(suiteName) && category === 'store-react';
  const extension = isReactFile ? '.tsx' : '.ts';
  
  const args = [
    'vitest',
    'bench',
    '--run',
    `--outputJson=${outputPath}`,
    `src/suites/${category}/${suiteName}.bench${extension}`
  ];
  
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, {
      cwd: projectRoot,
      env,
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${suiteName} benchmark completed`);
        resolve({ suite: suiteName, outputFile, status: 'success' });
      } else {
        console.error(`❌ ${suiteName} benchmark failed with code ${code}`);
        resolve({ suite: suiteName, outputFile, status: 'failed', code });
      }
    });
    
    child.on('error', (error) => {
      console.error(`❌ Error running ${suiteName} benchmark:`, error);
      resolve({ suite: suiteName, outputFile, status: 'error', error: error.message });
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
  console.log(`Suite: ${CONFIG.suite}`);
  console.log(`Mode: ${CONFIG.mode}`);
  console.log(`Memoization: ${CONFIG.disableMemoization ? 'disabled' : 'enabled'}`);
  console.log(`Timestamp: ${timestamp}`);
  
  try {
    // Setup directories
    await setupDirectories(timestamp);
    
    // Get the benchmark suites for the selected category
    const suites = BENCHMARK_SUITES[CONFIG.suite];
    if (!suites) {
      throw new Error(`Unknown suite: ${CONFIG.suite}. Valid options: ${Object.keys(BENCHMARK_SUITES).join(', ')}`);
    }
    
    // Run benchmarks sequentially to avoid memory issues
    const results = [];
    for (const suite of suites) {
      const result = await runBenchmarkSuite(suite, CONFIG.suite, timestamp);
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