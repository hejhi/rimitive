#!/usr/bin/env node

/**
 * @fileoverview Generate Markdown report from Vitest benchmark JSON results
 * 
 * Usage:
 *   node scripts/generate-markdown-report.js [input.json] [output.md]
 * 
 * If no files specified, uses bench-results.json and bench-report.md
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

function generateMarkdown(results, filename) {
  const timestamp = new Date().toISOString();
  const testGroups = new Map();
  let totalTests = 0;
  let totalDuration = 0;
  const allBenchmarks = [];
  const frameworkWins = new Map();
  
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
        const framework = getFramework(bench.name);
        const benchData = {
          name: bench.name,
          suiteName: suiteName,
          mean: bench.mean,
          hz: bench.hz,
          samples: bench.sampleCount,
          rme: bench.rme,
          min: bench.min,
          max: bench.max,
          p75: bench.p75,
          p99: bench.p99,
          p995: bench.p995,
          p999: bench.p999,
          framework: framework
        };
        testGroups.get(suiteName).push(benchData);
        allBenchmarks.push(benchData);
      });
    });
  });
  
  let md = `# Lattice Benchmark Report\n\n`;
  
  // Add mode badge if applicable
  if (filename.includes('raw')) {
    md += `> 🏷️ **RAW MODE** - Memoization disabled, measuring pure computation performance\n\n`;
  } else if (filename.includes('real')) {
    md += `> 🏷️ **REAL MODE** - Memoization enabled, measuring cached performance\n\n`;
  }
  
  md += `**Generated:** ${new Date(timestamp).toLocaleString()}  \n`;
  md += `**File:** \`${filename}\`\n\n`;
  
  // Summary section
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Tests | ${totalTests} |\n`;
  md += `| Test Suites | ${testGroups.size} |\n`;
  md += `| Total Duration | ${(totalDuration / 1000).toFixed(2)}s |\n\n`;
  
  // Framework legend
  md += `## Framework Legend\n\n`;
  md += `- 🟢 **Lattice** - Lattice Framework (store-react & core)\n`;
  md += `- 🔵 **Zustand** - Zustand Adapter\n`;
  md += `- 🟣 **Redux** - Redux Adapter\n\n`;
  
  // Generate tables for each suite
  testGroups.forEach((tests, suiteName) => {
    md += `## ${suiteName}\n\n`;
    
    // Sort tests by mean duration (fastest first) and add ranking
    const sortedTests = [...tests].sort((a, b) => a.mean - b.mean);
    sortedTests.forEach((test, index) => {
      test.rank = index + 1;
      // Track framework wins
      if (test.rank === 1) {
        frameworkWins.set(test.framework, (frameworkWins.get(test.framework) || 0) + 1);
      }
    });
    
    // Main results table with ranking
    md += `| Rank | Test Name | Framework | Mean | Ops/sec | Samples | RME |\n`;
    md += `|:----:|-----------|:---------:|-----:|--------:|--------:|----:|\n`;
    
    sortedTests.forEach(test => {
      const name = test.name.replace(/\|/g, '\\|'); // Escape pipes in test names
      const rankDisplay = test.rank === 1 ? '🥇' : test.rank === 2 ? '🥈' : test.rank === 3 ? '🥉' : test.rank;
      const frameworkEmoji = test.framework === 'Lattice' || test.framework === 'Lattice Core' ? '🟢' : 
                            test.framework === 'Zustand' ? '🔵' : 
                            test.framework === 'Redux' ? '🟣' : '⚪';
      md += `| ${rankDisplay} | ${name} | ${frameworkEmoji} ${test.framework} | ${formatDuration(test.mean)} | ${formatOpsPerSecond(test.hz)} | ${test.samples.toLocaleString()} | ±${test.rme.toFixed(2)}% |\n`;
    });
    
    md += '\n';
    
    // Framework performance summary for this suite
    const frameworkStats = new Map();
    tests.forEach(test => {
      if (!frameworkStats.has(test.framework)) {
        frameworkStats.set(test.framework, {
          count: 0,
          totalRank: 0,
          bestRank: Infinity,
          worstRank: 0
        });
      }
      const stats = frameworkStats.get(test.framework);
      stats.count++;
      stats.totalRank += test.rank;
      stats.bestRank = Math.min(stats.bestRank, test.rank);
      stats.worstRank = Math.max(stats.worstRank, test.rank);
    });
    
    if (frameworkStats.size > 1) {
      md += `### Framework Summary for ${suiteName}\n\n`;
      md += `| Framework | Tests | Avg Rank | Best | Worst |\n`;
      md += `|-----------|:-----:|:--------:|:----:|:-----:|\n`;
      
      Array.from(frameworkStats.entries())
        .sort((a, b) => (a[1].totalRank / a[1].count) - (b[1].totalRank / b[1].count))
        .forEach(([framework, stats]) => {
          const avgRank = stats.totalRank / stats.count;
          const frameworkEmoji = framework === 'Lattice' || framework === 'Lattice Core' ? '🟢' : 
                                framework === 'Zustand' ? '🔵' : 
                                framework === 'Redux' ? '🟣' : '⚪';
          md += `| ${frameworkEmoji} ${framework} | ${stats.count} | ${avgRank.toFixed(1)} | #${stats.bestRank} | #${stats.worstRank} |\n`;
        });
      md += '\n';
    }
    
    // Add detailed statistics for each test
    md += `<details>\n<summary>Detailed Statistics</summary>\n\n`;
    
    sortedTests.forEach(test => {
      md += `### ${test.rank}. ${test.name}\n\n`;
      md += `- **Framework:** ${test.framework}\n`;
      md += `- **Mean:** ${formatDuration(test.mean)}\n`;
      md += `- **Min:** ${formatDuration(test.min)}\n`;
      md += `- **Max:** ${formatDuration(test.max)}\n`;
      md += `- **Percentiles:**\n`;
      md += `  - P75: ${formatDuration(test.p75)}\n`;
      md += `  - P99: ${formatDuration(test.p99)}\n`;
      md += `  - P99.5: ${formatDuration(test.p995)}\n`;
      md += `  - P99.9: ${formatDuration(test.p999)}\n`;
      md += `- **Samples:** ${test.samples.toLocaleString()}\n`;
      md += `- **Operations/sec:** ${formatOpsPerSecond(test.hz)}\n\n`;
    });
    
    md += `</details>\n\n`;
  });
  
  // Overall performance insights
  md += `## Overall Performance Insights\n\n`;
  
  // Framework wins summary
  if (frameworkWins.size > 0) {
    md += `### Framework Wins (1st Place Finishes)\n\n`;
    md += `| Framework | Wins | Percentage |\n`;
    md += `|-----------|:----:|:----------:|\n`;
    
    const totalSuites = testGroups.size;
    Array.from(frameworkWins.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([framework, wins]) => {
        const percentage = ((wins / totalSuites) * 100).toFixed(1);
        const frameworkEmoji = framework === 'Lattice' || framework === 'Lattice Core' ? '🟢' : 
                              framework === 'Zustand' ? '🔵' : 
                              framework === 'Redux' ? '🟣' : '⚪';
        md += `| ${frameworkEmoji} ${framework} | ${wins} | ${percentage}% |\n`;
      });
    md += '\n';
  }
  
  // Find fastest and slowest tests
  const sortedBySpeed = [...allBenchmarks].sort((a, b) => a.mean - b.mean);
  
  if (sortedBySpeed.length > 0) {
    md += `### Top 5 Fastest Operations\n\n`;
    sortedBySpeed.slice(0, 5).forEach((test, i) => {
      const frameworkEmoji = test.framework === 'Lattice' || test.framework === 'Lattice Core' ? '🟢' : 
                            test.framework === 'Zustand' ? '🔵' : 
                            test.framework === 'Redux' ? '🟣' : '⚪';
      md += `${i + 1}. **${test.name}** ${frameworkEmoji} - ${formatDuration(test.mean)} (${formatOpsPerSecond(test.hz)})\n`;
    });
    
    md += `\n### Top 5 Slowest Operations\n\n`;
    sortedBySpeed.slice(-5).reverse().forEach((test, i) => {
      const frameworkEmoji = test.framework === 'Lattice' || test.framework === 'Lattice Core' ? '🟢' : 
                            test.framework === 'Zustand' ? '🔵' : 
                            test.framework === 'Redux' ? '🟣' : '⚪';
      md += `${i + 1}. **${test.name}** ${frameworkEmoji} - ${formatDuration(test.mean)} (${formatOpsPerSecond(test.hz)})\n`;
    });
  }
  
  // Footer
  md += `\n---\n\n`;
  md += `*Generated by Lattice Benchmark Suite*\n`;
  
  return md;
}

// Main
const args = process.argv.slice(2);
const inputFile = args[0] || 'bench-results.json';
const outputFile = args[1] || inputFile.replace('.json', '.md');

console.log(`Generating Markdown report from ${inputFile}`);

try {
  const results = JSON.parse(readFileSync(inputFile, 'utf-8'));
  const markdown = generateMarkdown(results, inputFile);
  writeFileSync(outputFile, markdown);
  console.log(`✅ Markdown report generated: ${outputFile}`);
} catch (error) {
  console.error(`❌ Failed to generate report: ${error.message}`);
  process.exit(1);
}