#!/usr/bin/env node

/**
 * @fileoverview Compare benchmark results between runs
 * 
 * Usage:
 *   node scripts/compare-benchmarks.js [results.json] [baseline.json]
 * 
 * If only one file is specified, uses it as the results file and looks for baseline
 * If no files are specified, compares bench-results.json with bench-baseline.json
 * 
 * Examples:
 *   node scripts/compare-benchmarks.js                    # Uses defaults
 *   node scripts/compare-benchmarks.js bench-results-raw.json  # Raw mode
 *   node scripts/compare-benchmarks.js bench-results-real.json # Real mode
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const THRESHOLD_PERCENT = 10; // Flag regressions > 10%

function loadResults(filename) {
  if (!existsSync(filename)) {
    console.error(`File not found: ${filename}`);
    process.exit(1);
  }
  
  try {
    return JSON.parse(readFileSync(filename, 'utf-8'));
  } catch (error) {
    console.error(`Failed to parse ${filename}:`, error.message);
    process.exit(1);
  }
}

function formatDuration(ns) {
  if (ns < 1000) return `${ns.toFixed(2)}ns`;
  if (ns < 1000000) return `${(ns / 1000).toFixed(2)}μs`;
  if (ns < 1000000000) return `${(ns / 1000000).toFixed(2)}ms`;
  return `${(ns / 1000000000).toFixed(2)}s`;
}

function formatChange(baseline, current) {
  const change = ((current - baseline) / baseline) * 100;
  const sign = change >= 0 ? '+' : '';
  const color = change > THRESHOLD_PERCENT ? '\x1b[31m' : change < -5 ? '\x1b[32m' : '\x1b[33m';
  return `${color}${sign}${change.toFixed(1)}%\x1b[0m`;
}

function compareBenchmarks(baseline, current) {
  console.log('\n📊 Benchmark Comparison Report\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const baselineMap = new Map();
  const currentMap = new Map();
  
  // Build maps for easy lookup
  baseline.testResults?.forEach(suite => {
    suite.assertionResults?.forEach(test => {
      if (test.title && test.duration !== undefined) {
        baselineMap.set(test.title, test.duration);
      }
    });
  });
  
  current.testResults?.forEach(suite => {
    suite.assertionResults?.forEach(test => {
      if (test.title && test.duration !== undefined) {
        currentMap.set(test.title, test.duration);
      }
    });
  });
  
  // Group results by suite
  const suites = new Map();
  
  current.testResults?.forEach(suite => {
    const suiteName = suite.name.split('/').pop().replace('.bench.ts', '');
    if (!suites.has(suiteName)) {
      suites.set(suiteName, []);
    }
    
    suite.assertionResults?.forEach(test => {
      if (test.title && currentMap.has(test.title)) {
        suites.get(suiteName).push({
          name: test.title,
          baseline: baselineMap.get(test.title),
          current: currentMap.get(test.title),
        });
      }
    });
  });
  
  let hasRegression = false;
  
  // Display results by suite
  suites.forEach((tests, suiteName) => {
    console.log(`\n📁 ${suiteName}\n`);
    console.log('┌─────────────────────────────────────┬────────────┬────────────┬──────────┐');
    console.log('│ Benchmark                           │ Baseline   │ Current    │ Change   │');
    console.log('├─────────────────────────────────────┼────────────┼────────────┼──────────┤');
    
    tests.forEach(test => {
      const name = test.name.length > 35 
        ? test.name.substring(0, 32) + '...' 
        : test.name.padEnd(35);
      
      if (test.baseline) {
        const change = ((test.current - test.baseline) / test.baseline) * 100;
        if (change > THRESHOLD_PERCENT) {
          hasRegression = true;
        }
        
        console.log(
          `│ ${name} │ ${formatDuration(test.baseline).padStart(10)} │ ${formatDuration(test.current).padStart(10)} │ ${formatChange(test.baseline, test.current).padStart(8)} │`
        );
      } else {
        console.log(
          `│ ${name} │ ${'N/A'.padStart(10)} │ ${formatDuration(test.current).padStart(10)} │ ${'NEW'.padStart(8)} │`
        );
      }
    });
    
    console.log('└─────────────────────────────────────┴────────────┴────────────┴──────────┘');
  });
  
  // Summary
  console.log('\n📈 Summary\n');
  
  const improved = Array.from(currentMap.entries()).filter(([name, current]) => {
    const baseline = baselineMap.get(name);
    return baseline && ((baseline - current) / baseline) * 100 > 5;
  }).length;
  
  const regressed = Array.from(currentMap.entries()).filter(([name, current]) => {
    const baseline = baselineMap.get(name);
    return baseline && ((current - baseline) / baseline) * 100 > THRESHOLD_PERCENT;
  }).length;
  
  const newTests = Array.from(currentMap.keys()).filter(name => !baselineMap.has(name)).length;
  
  console.log(`  ✅ Improved: ${improved} benchmarks`);
  console.log(`  ⚠️  Regressed: ${regressed} benchmarks`);
  console.log(`  🆕 New: ${newTests} benchmarks`);
  console.log(`  📊 Total: ${currentMap.size} benchmarks\n`);
  
  if (hasRegression) {
    console.log('❌ Performance regressions detected!\n');
    process.exit(1);
  } else {
    console.log('✅ All benchmarks within acceptable thresholds\n');
  }
}

// Main
const args = process.argv.slice(2);

let currentFile, baselineFile;

if (args.length === 0) {
  // No args: use defaults
  currentFile = 'bench-results.json';
  baselineFile = 'bench-baseline.json';
} else if (args.length === 1) {
  // One arg: use it as current file, derive baseline name
  currentFile = args[0];
  baselineFile = currentFile.replace('-results', '-baseline');
} else {
  // Two args: use as provided
  currentFile = args[0];
  baselineFile = args[1];
}

console.log(`Comparing ${currentFile} vs ${baselineFile}`);

const baseline = loadResults(baselineFile);
const current = loadResults(currentFile);

compareBenchmarks(baseline, current);