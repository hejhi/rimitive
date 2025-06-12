#!/usr/bin/env node

/**
 * @fileoverview Split a monolithic benchmark result file into chunked format
 * 
 * This script:
 * 1. Reads a single benchmark JSON file (e.g., bench-results-real.json)
 * 2. Splits it by test suite into individual files
 * 3. Creates a timestamped directory structure matching our chunked format
 * 4. Generates a summary file
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Map file paths to suite names
const SUITE_MAPPING = {
  'overhead.bench.ts': 'overhead',
  'head-to-head.bench.ts': 'head-to-head',
  'adapter-rankings.bench.ts': 'adapter-rankings',
  'real-world.bench.ts': 'real-world',
  'memory.bench.ts': 'memory',
  'react-transitions.bench.ts': 'react-transitions',
  'index.bench.ts': 'overhead' // index.bench.ts is the old name for overhead
};

/**
 * Extract suite name from filepath
 */
function getSuiteName(filepath) {
  const filename = path.basename(filepath);
  return SUITE_MAPPING[filename] || filename.replace('.bench.ts', '');
}

/**
 * Split benchmark results by suite
 */
function splitBenchmarkResults(data) {
  const suiteMap = new Map();
  
  if (!data.files || !Array.isArray(data.files)) {
    throw new Error('Invalid benchmark data: missing files array');
  }
  
  // Group files by suite
  for (const file of data.files) {
    const suiteName = getSuiteName(file.filepath);
    
    if (!suiteMap.has(suiteName)) {
      suiteMap.set(suiteName, {
        files: [],
        results: [],
        errors: [],
        reporterErrors: []
      });
    }
    
    const suiteData = suiteMap.get(suiteName);
    suiteData.files.push(file);
  }
  
  // Also distribute results, errors, etc. if they exist
  if (data.results && Array.isArray(data.results)) {
    for (const result of data.results) {
      // Try to match result to suite based on file path
      const matchingFile = data.files.find(f => 
        result.file === f.filepath || 
        result.filepath === f.filepath
      );
      
      if (matchingFile) {
        const suiteName = getSuiteName(matchingFile.filepath);
        const suiteData = suiteMap.get(suiteName);
        if (suiteData) {
          suiteData.results.push(result);
        }
      }
    }
  }
  
  return suiteMap;
}

/**
 * Main execution
 */
async function main() {
  const inputFile = process.argv[2];
  const outputDirName = process.argv[3];
  
  if (!inputFile) {
    console.error('Usage: node split-benchmark-results.js <input-file> [output-dir-name]');
    console.error('Example: node split-benchmark-results.js bench-results-real.json baseline-real');
    process.exit(1);
  }
  
  const inputPath = path.join(projectRoot, inputFile);
  const timestamp = outputDirName || new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const outputDir = path.join(projectRoot, 'dist/benchmarks', timestamp);
  
  console.log(`📂 Reading benchmark results from: ${inputPath}`);
  
  try {
    // Read input file
    const content = await fs.readFile(inputPath, 'utf-8');
    const data = JSON.parse(content);
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    // Split results by suite
    const suiteMap = splitBenchmarkResults(data);
    
    console.log(`📊 Found ${suiteMap.size} benchmark suites`);
    
    // Extract mode from filename (e.g., bench-results-real.json -> real)
    const mode = inputFile.includes('-real') ? 'real' : 'raw';
    
    // Write individual suite files
    const results = [];
    for (const [suiteName, suiteData] of suiteMap) {
      const outputFile = `${suiteName}-${mode}.json`;
      const outputPath = path.join(outputDir, outputFile);
      
      await fs.writeFile(outputPath, JSON.stringify(suiteData, null, 2));
      console.log(`✅ Created ${outputFile}`);
      
      results.push({
        suite: suiteName,
        outputFile,
        status: 'success'
      });
    }
    
    // Generate summary file
    const summary = {
      timestamp,
      mode,
      memoizationDisabled: mode === 'raw',
      nodeOptions: {
        maxOldSpaceSize: 4096
      },
      suites: results,
      generatedAt: new Date().toISOString(),
      sourceFile: inputFile,
      splitFrom: 'monolithic'
    };
    
    await fs.writeFile(
      path.join(outputDir, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );
    
    console.log(`\n✅ Split complete!`);
    console.log(`📁 Results directory: ${outputDir}`);
    
    // Get file stats
    const stats = await fs.stat(inputPath);
    const sizeInKB = (stats.size / 1024).toFixed(1);
    console.log(`📊 Original file size: ${sizeInKB}KB`);
    
    // Count total benchmarks
    let totalBenchmarks = 0;
    for (const file of data.files) {
      if (file.groups) {
        for (const group of file.groups) {
          totalBenchmarks += (group.benchmarks || []).length;
        }
      }
    }
    console.log(`📊 Total benchmarks: ${totalBenchmarks}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}