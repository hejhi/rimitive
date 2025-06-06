#!/usr/bin/env node

/**
 * @fileoverview Run benchmarks and capture results in JSON format
 * 
 * Since Vitest benchmarks don't have built-in JSON export,
 * this script captures and parses the output
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

const args = process.argv.slice(2);
const outputFile = args[0] || 'bench-results.json';
const isRawMode = outputFile.includes('raw');

// Build the command
const env = { ...process.env };
if (isRawMode) {
  env.LATTICE_DISABLE_MEMOIZATION = 'true';
}
env.NODE_OPTIONS = '--max-old-space-size=4096';

const startTime = Date.now();
let output = '';
let testResults = [];
let currentSuite = null;

// Run vitest bench
const child = spawn('vitest', ['bench', '--run'], {
  env,
  stdio: ['inherit', 'pipe', 'pipe'],
  cwd: process.cwd()
});

// Parse the output line by line
child.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  output += data.toString();
  
  lines.forEach(line => {
    // Parse suite names
    if (line.includes(' > ') && !line.includes('·')) {
      const match = line.match(/✓\s+(.+?)\s+>\s+(.+?)\s+>\s+(.+?)\s+\d+ms/);
      if (match) {
        currentSuite = `${match[2]} > ${match[3]}`;
      }
    }
    
    // Parse benchmark results
    if (line.includes('·') && currentSuite) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 10) {
        const name = parts.slice(1, parts.findIndex(p => !isNaN(parseFloat(p.replace(',', ''))))).join(' ');
        const hz = parseFloat(parts.find(p => p.match(/[\d,]+\.\d+/))?.replace(',', '') || '0');
        const metrics = parts.slice(parts.findIndex(p => p.match(/[\d,]+\.\d+/)));
        
        // Parse timing values
        const parseTime = (value) => {
          if (!value) return 0;
          const num = parseFloat(value);
          if (value.includes('ms')) return num * 1000000; // ms to ns
          if (value.includes('μs')) return num * 1000; // μs to ns
          return num; // already ns
        };
        
        testResults.push({
          name: name.replace('·', '').trim(),
          suiteName: currentSuite,
          benchmark: {
            hz: hz,
            min: parseTime(metrics[1]),
            max: parseTime(metrics[2]),
            mean: parseTime(metrics[3]),
            p50: parseTime(metrics[3]), // Using mean as p50 approximation
            p75: parseTime(metrics[4]),
            p99: parseTime(metrics[5]),
            p995: parseTime(metrics[6]),
            p999: parseTime(metrics[7]),
            rme: parseFloat(metrics[8]?.replace('±', '').replace('%', '') || '0'),
            samples: parseInt(metrics[9]?.replace(',', '') || '100'),
            ops: Math.floor(hz)
          }
        });
      }
    }
  });
});

child.stderr.on('data', (data) => {
  console.error(data.toString());
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`Benchmark process exited with code ${code}`);
    process.exit(code);
  }
  
  const duration = Date.now() - startTime;
  
  // Create JSON output in Vitest-like format
  const jsonOutput = {
    version: '3.1.4',
    duration: duration,
    testResults: testResults
  };
  
  writeFileSync(outputFile, JSON.stringify(jsonOutput, null, 2));
  console.log(`\n✅ Benchmark results saved to ${outputFile}`);
  console.log(`   Total tests: ${testResults.length}`);
  console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
});