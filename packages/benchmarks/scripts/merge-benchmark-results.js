#!/usr/bin/env node

/**
 * @fileoverview Merge chunked benchmark results into a single file
 * 
 * This script:
 * 1. Reads all individual benchmark JSON files from a timestamped directory
 * 2. Merges them into a single result file
 * 3. Preserves the original structure expected by comparison tools
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * Read and parse a JSON file
 */
async function readJsonFile(filepath) {
  try {
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${filepath}:`, error.message);
    return null;
  }
}

/**
 * Merge multiple benchmark results
 */
function mergeBenchmarkResults(results) {
  const merged = {
    files: [],
    results: [],
    errors: [],
    reporterErrors: []
  };
  
  for (const result of results) {
    if (!result) continue;
    
    // Merge files
    if (result.files) {
      merged.files.push(...result.files);
    }
    
    // Merge results
    if (result.results) {
      merged.results.push(...result.results);
    }
    
    // Merge errors
    if (result.errors) {
      merged.errors.push(...result.errors);
    }
    
    // Merge reporter errors
    if (result.reporterErrors) {
      merged.reporterErrors.push(...result.reporterErrors);
    }
  }
  
  return merged;
}

/**
 * Main execution
 */
async function main() {
  const timestampDir = process.argv[2];
  const outputFile = process.argv[3];
  
  if (!timestampDir) {
    console.error('Usage: node merge-benchmark-results.js <timestamp-dir> [output-file]');
    console.error('Example: node merge-benchmark-results.js 2024-06-12T10-30-00 merged-results.json');
    process.exit(1);
  }
  
  const inputDir = path.join(projectRoot, 'dist/benchmarks', timestampDir);
  const outputPath = outputFile 
    ? path.join(projectRoot, outputFile)
    : path.join(inputDir, 'merged-results.json');
  
  console.log(`📂 Reading benchmark results from: ${inputDir}`);
  
  try {
    // Check if directory exists
    await fs.access(inputDir);
    
    // Read all JSON files in the directory
    const files = await fs.readdir(inputDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'summary.json' && f !== 'merged-results.json');
    
    if (jsonFiles.length === 0) {
      console.error('❌ No benchmark result files found');
      process.exit(1);
    }
    
    console.log(`📊 Found ${jsonFiles.length} benchmark result files`);
    
    // Read all results
    const results = await Promise.all(
      jsonFiles.map(file => readJsonFile(path.join(inputDir, file)))
    );
    
    // Merge results
    const merged = mergeBenchmarkResults(results);
    
    // Add metadata
    merged.metadata = {
      mergedAt: new Date().toISOString(),
      sourceDirectory: timestampDir,
      sourceFiles: jsonFiles,
      totalFiles: merged.files.length,
      totalResults: merged.results.length,
      totalErrors: merged.errors.length
    };
    
    // Write merged results
    await fs.writeFile(outputPath, JSON.stringify(merged, null, 2));
    
    console.log(`\n✅ Merged results written to: ${outputPath}`);
    console.log(`📊 Total benchmark files: ${merged.files.length}`);
    console.log(`📊 Total benchmark results: ${merged.results.length}`);
    if (merged.errors.length > 0) {
      console.log(`⚠️  Total errors: ${merged.errors.length}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}