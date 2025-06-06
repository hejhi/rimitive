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

function getFramework(testName) {
  if (testName.toLowerCase().includes('zustand')) return 'Zustand';
  if (testName.toLowerCase().includes('redux')) return 'Redux';
  if (testName.toLowerCase().includes('react adapter') || testName.toLowerCase().includes('lattice')) return 'Lattice';
  if (testName.toLowerCase().includes('core') || testName.toLowerCase().includes('compose') || testName.toLowerCase().includes('createslice')) return 'Lattice Core';
  return 'Other';
}

function getFrameworkColor(framework) {
  const colors = {
    'Lattice': '#10b981', // Green
    'Lattice Core': '#10b981', // Green
    'Zustand': '#3b82f6', // Blue
    'Redux': '#8b5cf6', // Purple
    'Other': '#6b7280' // Gray
  };
  return colors[framework] || colors.Other;
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
          rme: bench.rme,
          framework: getFramework(bench.name)
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
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --lattice: #10b981;
      --zustand: #3b82f6;
      --redux: #8b5cf6;
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
    
    .rank {
      text-align: center;
      font-weight: bold;
      font-size: 1.1em;
    }
    
    .rank-1 { color: var(--success); }
    .rank-2 { color: #22c55e; }
    .rank-3 { color: #84cc16; }
    .rank-fastest { background-color: rgba(16, 185, 129, 0.1); }
    .rank-slowest { background-color: rgba(239, 68, 68, 0.1); }
    
    .framework-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: 500;
      margin-left: 8px;
      color: white;
    }
    
    .framework-lattice { background-color: var(--lattice); }
    .framework-zustand { background-color: var(--zustand); }
    .framework-redux { background-color: var(--redux); }
    .framework-other { background-color: var(--text-secondary); }
    
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
    
    .legend {
      margin-bottom: 20px;
      padding: 15px;
      background-color: var(--bg-secondary);
      border-radius: 8px;
    }
    
    .legend-title {
      font-weight: 600;
      margin-bottom: 10px;
    }
    
    .legend-items {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .comparison-note {
      margin-top: 10px;
      padding: 10px 15px;
      background-color: rgba(59, 130, 246, 0.1);
      border-left: 4px solid var(--accent);
      border-radius: 4px;
      font-size: 0.9em;
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

    <div class="legend">
      <div class="legend-title">Framework Legend</div>
      <div class="legend-items">
        <div class="legend-item">
          <span class="framework-badge framework-lattice">Lattice</span>
          <span>Lattice Framework (store-react & core)</span>
        </div>
        <div class="legend-item">
          <span class="framework-badge framework-zustand">Zustand</span>
          <span>Zustand Adapter</span>
        </div>
        <div class="legend-item">
          <span class="framework-badge framework-redux">Redux</span>
          <span>Redux Adapter</span>
        </div>
      </div>
    </div>
`;

  // Generate table for each suite
  testGroups.forEach((tests, suiteName) => {
    // Sort tests by mean duration (fastest first) and add ranking
    const sortedTests = [...tests].sort((a, b) => a.mean - b.mean);
    sortedTests.forEach((test, index) => {
      test.rank = index + 1;
    });
    
    // Find tests that are comparable (similar operations)
    const comparableGroups = new Map();
    tests.forEach(test => {
      // Extract operation type from test name
      const operation = test.name.replace(/^(Zustand|Redux|React adapter|Lattice) - /, '');
      if (!comparableGroups.has(operation)) {
        comparableGroups.set(operation, []);
      }
      comparableGroups.get(operation).push(test);
    });
    
    html += `
    <div class="suite">
      <h2>${suiteName}</h2>`;
    
    // Add comparison note if there are comparable tests
    const hasComparisons = Array.from(comparableGroups.values()).some(group => group.length > 1);
    if (hasComparisons) {
      html += `
      <div class="comparison-note">
        💡 Tests with similar names are comparable across frameworks. Rankings show relative performance.
      </div>`;
    }
    
    html += `
      <table>
        <thead>
          <tr>
            <th style="text-align: center">Rank</th>
            <th>Test Name</th>
            <th>Framework</th>
            <th style="text-align: right">Mean Duration</th>
            <th style="text-align: right">Operations/sec</th>
            <th style="text-align: right">Samples</th>
            <th style="text-align: right">RME ±%</th>
          </tr>
        </thead>
        <tbody>`;
    
    sortedTests.forEach(test => {
      const isFirstRank = test.rank === 1;
      const isLastRank = test.rank === sortedTests.length;
      const rankClass = test.rank <= 3 ? `rank-${test.rank}` : '';
      const rowClass = isFirstRank ? 'rank-fastest' : (isLastRank ? 'rank-slowest' : '');
      
      html += `
          <tr class="${rowClass}">
            <td class="rank ${rankClass}">${test.rank}</td>
            <td class="test-name">${test.name}</td>
            <td>
              <span class="framework-badge framework-${test.framework.toLowerCase().replace(' ', '-')}">${test.framework}</span>
            </td>
            <td class="duration">${formatDuration(test.mean)}</td>
            <td class="ops-per-second">${formatOpsPerSecond(test.hz)}</td>
            <td class="samples">${test.samples.toLocaleString()}</td>
            <td class="rme">±${test.rme.toFixed(2)}%</td>
          </tr>`;
    });
    
    html += `
        </tbody>
      </table>`;
    
    // Add framework performance summary for this suite
    const frameworkStats = new Map();
    tests.forEach(test => {
      if (!frameworkStats.has(test.framework)) {
        frameworkStats.set(test.framework, {
          count: 0,
          totalRank: 0,
          tests: []
        });
      }
      const stats = frameworkStats.get(test.framework);
      stats.count++;
      stats.totalRank += test.rank;
      stats.tests.push(test);
    });
    
    if (frameworkStats.size > 1) {
      html += `
      <div style="margin-top: 20px; padding: 15px; background-color: var(--bg-secondary); border-radius: 8px;">
        <h4 style="margin-top: 0;">Framework Performance Summary</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">`;
      
      Array.from(frameworkStats.entries())
        .sort((a, b) => (a[1].totalRank / a[1].count) - (b[1].totalRank / b[1].count))
        .forEach(([framework, stats]) => {
          const avgRank = stats.totalRank / stats.count;
          const bestTest = stats.tests.reduce((best, test) => test.rank < best.rank ? test : best);
          html += `
          <div style="padding: 10px; background-color: var(--bg-primary); border-radius: 4px; border: 2px solid ${getFrameworkColor(framework)};">
            <div style="font-weight: 600; color: ${getFrameworkColor(framework)};">${framework}</div>
            <div style="font-size: 0.9em; color: var(--text-secondary); margin-top: 5px;">
              Avg Rank: ${avgRank.toFixed(1)} | Tests: ${stats.count}<br>
              Best: #${bestTest.rank} - ${formatDuration(bestTest.mean)}
            </div>
          </div>`;
        });
      
      html += `
        </div>
      </div>`;
    }
    
    html += `
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