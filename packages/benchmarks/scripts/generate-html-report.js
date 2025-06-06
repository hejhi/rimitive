#!/usr/bin/env node

/**
 * @fileoverview Generate HTML report from Vitest benchmark JSON results
 * 
 * Usage:
 *   node scripts/generate-html-report.js [input.json] [output.html]
 * 
 * If no files specified, uses bench-results.json and bench-report.html
 */

import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';

function formatDuration(ms) {
  const ns = ms * 1000000; // Vitest gives ms, convert to ns for consistency
  if (ns < 1000) return `${ns.toFixed(2)}ns`;
  if (ns < 1000000) return `${(ns / 1000).toFixed(2)}μs`;
  if (ns < 1000000000) return `${(ns / 1000000).toFixed(2)}ms`;
  return `${(ns / 1000000000).toFixed(2)}s`;
}

function formatOpsPerSecond(hz) {
  if (hz > 1000000) return `${(hz / 1000000).toFixed(2)}M ops/s`;
  if (hz > 1000) return `${(hz / 1000).toFixed(2)}K ops/s`;
  return `${hz.toFixed(2)} ops/s`;
}

function generateHTML(results, filename) {
  const timestamp = new Date().toISOString();
  const testGroups = new Map();
  let totalTests = 0;
  let totalDuration = 0;
  
  // Process Vitest benchmark JSON format
  results.files.forEach(file => {
    file.groups.forEach(group => {
      const suiteName = group.fullName.split(' > ').slice(1).join(' > ');
      if (!testGroups.has(suiteName)) {
        testGroups.set(suiteName, []);
      }
      
      group.benchmarks.forEach(bench => {
        totalTests++;
        totalDuration += bench.totalTime;
        testGroups.get(suiteName).push({
          name: bench.name,
          mean: bench.mean,
          hz: bench.hz,
          samples: bench.sampleCount,
          rme: bench.rme
        });
      });
    });
  });
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lattice Benchmark Report - ${basename(filename)}</title>
  <style>
    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f5f5f5;
      --text-primary: #333333;
      --text-secondary: #666666;
      --border: #e0e0e0;
      --accent: #007bff;
      --success: #28a745;
      --warning: #ffc107;
      --danger: #dc3545;
    }
    
    @media (prefers-color-scheme: dark) {
      :root {
        --bg-primary: #1a1a1a;
        --bg-secondary: #2a2a2a;
        --text-primary: #ffffff;
        --text-secondary: #cccccc;
        --border: #444444;
      }
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    h1, h2 {
      color: var(--text-primary);
    }
    
    h1 {
      font-size: 2em;
      margin-bottom: 10px;
    }
    
    .metadata {
      color: var(--text-secondary);
      margin-bottom: 30px;
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    
    .summary-card {
      background-color: var(--bg-secondary);
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    
    .summary-card h3 {
      margin: 0 0 10px 0;
      font-size: 0.9em;
      text-transform: uppercase;
      color: var(--text-secondary);
    }
    
    .summary-card .value {
      font-size: 2em;
      font-weight: bold;
      color: var(--accent);
    }
    
    .suite {
      margin-bottom: 40px;
    }
    
    .suite h2 {
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--border);
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background-color: var(--bg-secondary);
      border-radius: 8px;
      overflow: hidden;
    }
    
    th, td {
      padding: 12px 16px;
      text-align: left;
    }
    
    th {
      background-color: var(--bg-primary);
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      font-size: 0.85em;
      letter-spacing: 0.5px;
    }
    
    tr:hover {
      background-color: var(--bg-primary);
    }
    
    td {
      border-top: 1px solid var(--border);
    }
    
    .test-name {
      font-weight: 500;
    }
    
    .duration {
      font-family: 'Courier New', monospace;
      text-align: right;
    }
    
    .ops-per-second {
      text-align: right;
      color: var(--text-secondary);
    }
    
    .samples {
      text-align: right;
      color: var(--text-secondary);
    }
    
    .rme {
      text-align: right;
      color: var(--text-secondary);
      font-size: 0.9em;
    }
    
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-secondary);
      font-size: 0.9em;
    }
    
    .mode-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: 500;
      margin-left: 10px;
    }
    
    .mode-raw {
      background-color: var(--warning);
      color: #000;
    }
    
    .mode-real {
      background-color: var(--success);
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      Lattice Benchmark Report
      ${filename.includes('raw') ? '<span class="mode-badge mode-raw">RAW MODE</span>' : ''}
      ${filename.includes('real') ? '<span class="mode-badge mode-real">REAL MODE</span>' : ''}
    </h1>
    <div class="metadata">
      <p>Generated: ${new Date(timestamp).toLocaleString()}</p>
      <p>File: ${filename}</p>
    </div>
    
    <div class="summary">
      <div class="summary-card">
        <h3>Total Tests</h3>
        <div class="value">${totalTests}</div>
      </div>
      <div class="summary-card">
        <h3>Test Suites</h3>
        <div class="value">${testGroups.size}</div>
      </div>
      <div class="summary-card">
        <h3>Total Duration</h3>
        <div class="value">${(totalDuration / 1000).toFixed(2)}s</div>
      </div>
    </div>
`;

  // Generate table for each suite
  testGroups.forEach((tests, suiteName) => {
    html += `
    <div class="suite">
      <h2>${suiteName}</h2>
      <table>
        <thead>
          <tr>
            <th>Test Name</th>
            <th style="text-align: right">Mean Duration</th>
            <th style="text-align: right">Operations/sec</th>
            <th style="text-align: right">Samples</th>
            <th style="text-align: right">RME ±%</th>
          </tr>
        </thead>
        <tbody>`;
    
    tests.sort((a, b) => a.name.localeCompare(b.name)).forEach(test => {
      html += `
          <tr>
            <td class="test-name">${test.name}</td>
            <td class="duration">${formatDuration(test.mean)}</td>
            <td class="ops-per-second">${formatOpsPerSecond(test.hz)}</td>
            <td class="samples">${test.samples.toLocaleString()}</td>
            <td class="rme">±${test.rme.toFixed(2)}%</td>
          </tr>`;
    });
    
    html += `
        </tbody>
      </table>
    </div>`;
  });

  html += `
    <div class="footer">
      <p>Lattice Performance Benchmarks</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

// Main
const args = process.argv.slice(2);
const inputFile = args[0] || 'bench-results.json';
const outputFile = args[1] || inputFile.replace('.json', '.html');

console.log(`Generating HTML report from ${inputFile}`);

try {
  const results = JSON.parse(readFileSync(inputFile, 'utf-8'));
  const html = generateHTML(results, inputFile);
  writeFileSync(outputFile, html);
  console.log(`✅ HTML report generated: ${outputFile}`);
} catch (error) {
  console.error(`❌ Failed to generate report: ${error.message}`);
  process.exit(1);
}