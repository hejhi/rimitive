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
    'fine-grained-reactivity',
    'svelte-vs-lattice',
  ],
};

// Configuration
const CONFIG = {
  outputDir: 'dist',
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
  const isSvelteFile = ['svelte-vs-lattice'].includes(suiteName) && category === 'lattice';
  const extension = isReactFile ? '.tsx' : isSvelteFile ? '.svelte.ts' : '.ts';
  
  const args = [
    'exec',
    'vitest',
    'bench',
    '--run',
    `--reporter=verbose`,
    `--outputJson=${outputPath}`,
    `src/suites/${category}/${suiteName}.bench${extension}`
  ];
  
  // Add Node.js options for the spawned process
  if (!env.NODE_OPTIONS) {
    env.NODE_OPTIONS = '--expose-gc';
  } else if (!env.NODE_OPTIONS.includes('--expose-gc')) {
    env.NODE_OPTIONS += ' --expose-gc';
  }
  
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    
    const child = spawn('pnpm', args, {
      cwd: projectRoot,
      env,
      stdio: ['inherit', 'pipe', 'pipe']
    });
    
    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output); // Still show output to user
    });
    
    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output); // Still show output to user
    });
    
    child.on('close', async (code) => {
      if (code === 0) {
        // Parse memory information from stdout and enhance JSON output
        try {
          await enhanceJsonWithMemoryData(outputPath, stdout);
        } catch (error) {
          console.warn(`⚠️ Could not enhance ${suiteName} with memory data:`, error.message);
        }
        
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
 * Enhance JSON output with memory data from stdout
 */
async function enhanceJsonWithMemoryData(outputPath, stdout) {
  try {
    // Read the existing JSON output
    const jsonContent = await fs.readFile(outputPath, 'utf8');
    const data = JSON.parse(jsonContent);
    
    // Parse memory information from stdout
    const memoryData = parseMemoryFromOutput(stdout);
    
    // Enhance the JSON with memory information
    const enhancedData = {
      ...data,
      memoryTracking: {
        enabled: true,
        parsedFromOutput: true,
        memoryMeasurements: memoryData
      }
    };
    
    // Enhance individual benchmark results
    if (enhancedData.files) {
      enhancedData.files = enhancedData.files.map(file => ({
        ...file,
        groups: file.groups?.map(group => ({
          ...group,
          benchmarks: group.benchmarks?.map(benchmark => {
            const memInfo = memoryData.find(m => m.benchmarkName === benchmark.name);
            return {
              ...benchmark,
              memoryUsage: memInfo || null
            };
          })
        }))
      }));
    }
    
    // Write enhanced JSON back
    await fs.writeFile(outputPath, JSON.stringify(enhancedData, null, 2));
  } catch (error) {
    console.warn('Failed to enhance JSON with memory data:', error.message);
  }
}

/**
 * Parse memory measurements from stdout
 */
function parseMemoryFromOutput(stdout) {
  const memoryMeasurements = [];
  const lines = stdout.split('\n');
  
  for (const line of lines) {
    // Look for memory log patterns
    const setupMatch = line.match(/(\w+.*?) setup memory: ([\d.]+\s*\w+)/);
    const deltaMatch = line.match(/(\w+.*?) memory delta: ([\d.]+\s*\w+)/);
    const totalMatch = line.match(/(\w+.*?) total memory: ([\d.]+\s*\w+)/);
    
    if (setupMatch) {
      const [, benchmarkName, memoryValue] = setupMatch;
      let existing = memoryMeasurements.find(m => m.benchmarkName.includes(benchmarkName.trim()));
      if (!existing) {
        existing = { benchmarkName: benchmarkName.trim(), measurements: {} };
        memoryMeasurements.push(existing);
      }
      existing.measurements.setup = memoryValue.trim();
    }
    
    if (deltaMatch) {
      const [, benchmarkName, memoryValue] = deltaMatch;
      let existing = memoryMeasurements.find(m => m.benchmarkName.includes(benchmarkName.trim()));
      if (!existing) {
        existing = { benchmarkName: benchmarkName.trim(), measurements: {} };
        memoryMeasurements.push(existing);
      }
      existing.measurements.delta = memoryValue.trim();
    }
    
    if (totalMatch) {
      const [, benchmarkName, memoryValue] = totalMatch;
      let existing = memoryMeasurements.find(m => m.benchmarkName.includes(benchmarkName.trim()));
      if (!existing) {
        existing = { benchmarkName: benchmarkName.trim(), measurements: {} };
        memoryMeasurements.push(existing);
      }
      existing.measurements.total = memoryValue.trim();
    }
  }
  
  return memoryMeasurements;
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
 * Generate human-readable timestamp for directory naming
 * Format: YYYY-MM-DD|HH:MM:SS (newest first when sorted alphabetically)
 */
function generateTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}|${hours}:${minutes}:${seconds}`;
}

/**
 * Main execution
 */
async function main() {
  const timestamp = generateTimestamp();
  
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
    console.log(`📁 Results directory: ${timestamp}`);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}