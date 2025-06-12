#!/usr/bin/env node

/**
 * Compare benchmark results
 * Usage: node compare-benchmarks.js [baseline.json] [current.json]
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadResults(filename) {
  try {
    const content = readFileSync(resolve(filename), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load ${filename}:`, error.message);
    process.exit(1);
  }
}

function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(Math.round(num));
}

function formatPercent(num) {
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

function compareBenchmarks(baseline, current) {
  console.log('\n📊 Benchmark Comparison\n');
  console.log('Baseline:', baseline.metadata?.timestamp || 'Unknown');
  console.log('Current:', current.metadata?.timestamp || 'Unknown');
  console.log('\n' + '='.repeat(80) + '\n');

  const baselineMap = new Map();
  const currentMap = new Map();

  // Build maps for easy lookup
  baseline.testResults?.forEach(suite => {
    suite.tests?.forEach(test => {
      if (test.result?.benchmark) {
        baselineMap.set(test.name, test.result.benchmark);
      }
    });
  });

  current.testResults?.forEach(suite => {
    suite.tests?.forEach(test => {
      if (test.result?.benchmark) {
        currentMap.set(test.name, test.result.benchmark);
      }
    });
  });

  // Compare results
  const results = [];
  
  for (const [name, currentBench] of currentMap) {
    const baselineBench = baselineMap.get(name);
    
    if (baselineBench) {
      const baselineOps = baselineBench.hz;
      const currentOps = currentBench.hz;
      const change = ((currentOps - baselineOps) / baselineOps) * 100;
      
      results.push({
        name,
        baseline: baselineOps,
        current: currentOps,
        change,
        significant: Math.abs(change) > 5
      });
    }
  }

  // Sort by change percentage
  results.sort((a, b) => b.change - a.change);

  // Display results
  console.log('Improvements:');
  results.filter(r => r.change > 0).forEach(r => {
    const marker = r.significant ? '✅' : '  ';
    console.log(`${marker} ${r.name}`);
    console.log(`   ${formatNumber(r.baseline)} ops/s → ${formatNumber(r.current)} ops/s (${formatPercent(r.change)})`);
  });

  console.log('\nRegressions:');
  results.filter(r => r.change < 0).forEach(r => {
    const marker = r.significant ? '❌' : '  ';
    console.log(`${marker} ${r.name}`);
    console.log(`   ${formatNumber(r.baseline)} ops/s → ${formatNumber(r.current)} ops/s (${formatPercent(r.change)})`);
  });

  console.log('\nNo Change:');
  results.filter(r => r.change === 0).forEach(r => {
    console.log(`   ${r.name}: ${formatNumber(r.current)} ops/s`);
  });

  // Summary
  const improvements = results.filter(r => r.change > 5).length;
  const regressions = results.filter(r => r.change < -5).length;
  const total = results.length;

  console.log('\n' + '='.repeat(80));
  console.log(`\nSummary: ${improvements} improvements, ${regressions} regressions, ${total} total benchmarks`);
  
  if (regressions > 0) {
    console.log('\n⚠️  Performance regressions detected!');
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error('Usage: node compare-benchmarks.js <baseline.json> <current.json>');
  process.exit(1);
}

const baseline = loadResults(args[0]);
const current = loadResults(args[1]);

compareBenchmarks(baseline, current);