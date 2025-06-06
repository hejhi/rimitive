#!/usr/bin/env node

/**
 * @fileoverview Run benchmarks and save results as JSON
 * 
 * Uses Vitest's programmatic API to get proper JSON output
 */

import { startVitest } from 'vitest/node';
import { writeFileSync } from 'fs';

const args = process.argv.slice(2);
const outputFile = args[0] || 'bench-results.json';
const isRawMode = outputFile.includes('raw');

// Configure environment
if (isRawMode) {
  process.env.LATTICE_DISABLE_MEMOIZATION = 'true';
}

console.log(`Running benchmarks (${isRawMode ? 'RAW' : 'REAL'} mode)...`);

const vitest = await startVitest('bench', [], {
  watch: false,
  benchmark: {
    reporters: ['verbose']
  }
});

if (!vitest) {
  console.error('Failed to start Vitest');
  process.exit(1);
}

// Collect results
const results = {
  version: vitest.version || '3.1.4',
  duration: 0,
  testResults: []
};

const startTime = Date.now();

// Get benchmark results from the test files
const files = await vitest.getTestFilepaths();
for (const file of files) {
  const suite = await vitest.collectTests([file]);
  
  for (const task of suite) {
    if (task.type === 'suite' && task.tasks) {
      for (const test of task.tasks) {
        if (test.result?.benchmark) {
          results.testResults.push({
            name: test.name,
            suiteName: task.name,
            benchmark: test.result.benchmark
          });
        }
      }
    }
  }
}

// Run all tests
await vitest.run();

results.duration = Date.now() - startTime;

// Get the actual results after running
const state = vitest.state;
const benchmarks = [];

state.getFiles().forEach(file => {
  file.tasks.forEach(suite => {
    if (suite.type === 'suite') {
      suite.tasks?.forEach(test => {
        if (test.result?.benchmark) {
          benchmarks.push({
            name: test.name,
            suiteName: suite.name,
            benchmark: {
              ...test.result.benchmark,
              // Ensure we have all expected fields
              hz: test.result.benchmark.hz || 0,
              min: test.result.benchmark.min || 0,
              max: test.result.benchmark.max || 0,
              mean: test.result.benchmark.mean || 0,
              p50: test.result.benchmark.p50 || test.result.benchmark.mean || 0,
              p75: test.result.benchmark.p75 || 0,
              p99: test.result.benchmark.p99 || 0,
              p995: test.result.benchmark.p995 || 0,
              p999: test.result.benchmark.p999 || 0,
              rme: test.result.benchmark.rme || 0,
              samples: test.result.benchmark.samples || 0,
              ops: Math.floor(test.result.benchmark.hz || 0),
              sd: test.result.benchmark.sd || 0
            }
          });
        }
      });
    }
  });
});

if (benchmarks.length > 0) {
  results.testResults = benchmarks;
}

// Write results
writeFileSync(outputFile, JSON.stringify(results, null, 2));
console.log(`\n✅ Benchmark results saved to ${outputFile}`);
console.log(`   Total tests: ${results.testResults.length}`);
console.log(`   Duration: ${(results.duration / 1000).toFixed(2)}s`);

await vitest.close();
process.exit(0);