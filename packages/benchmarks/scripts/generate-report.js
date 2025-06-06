#!/usr/bin/env node

/**
 * @fileoverview Modern benchmark report generator with proper test grouping
 * 
 * Features:
 * - Proper test grouping by category
 * - Tailwind CSS styling
 * - Comparative analysis between similar tests
 * - Multiple output formats (HTML, Markdown)
 */

import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';

// Test categorization configuration
const TEST_CATEGORIES = {
  'Store Creation': {
    id: 'store-creation',
    description: 'Measures the overhead of creating stores with different adapters',
    patterns: [
      /create store/i,
      /store creation/i,
      /mount.*hook/i
    ]
  },
  'State Updates': {
    id: 'state-updates', 
    description: 'Benchmarks for updating state in various scenarios',
    patterns: [
      /sequential updates/i,
      /bulk update/i,
      /state changes/i,
      /rapid.*changes/i,
      /concurrent updates/i,
      /batched updates/i
    ]
  },
  'View Computation': {
    id: 'view-computation',
    description: 'Performance of computed values and filtered views',
    patterns: [
      /compute.*view/i,
      /filtered view/i,
      /stats view/i,
      /view access/i,
      /view calculations/i
    ]
  },
  'Subscriptions': {
    id: 'subscriptions',
    description: 'Subscription creation and notification performance',
    patterns: [
      /subscription/i,
      /subscribe/i,
      /re-renders/i
    ]
  },
  'Real-World Scenarios': {
    id: 'real-world',
    description: 'Benchmarks simulating real application patterns',
    patterns: [
      /shopping cart/i,
      /e-commerce/i,
      /dashboard/i,
      /real-time/i,
      /metric updates/i,
      /product.*filter/i
    ]
  },
  'Core Operations': {
    id: 'core-ops',
    description: 'Low-level Lattice core performance',
    patterns: [
      /createSlice/i,
      /compose/i,
      /deep nesting/i,
      /dependency/i
    ]
  },
  'Memory & Cleanup': {
    id: 'memory-cleanup',
    description: 'Memory usage and cleanup operations',
    patterns: [
      /memory/i,
      /cleanup/i,
      /mount.*unmount/i,
      /gc pressure/i
    ]
  }
};

// Framework configuration
const FRAMEWORKS = {
  'lattice': {
    name: 'Lattice',
    color: '#10b981',
    emoji: '🟢',
    patterns: [/lattice/i, /react adapter/i, /core/i, /createslice/i, /compose/i]
  },
  'zustand': {
    name: 'Zustand',
    color: '#3b82f6',
    emoji: '🔵',
    patterns: [/zustand/i]
  },
  'redux': {
    name: 'Redux',
    color: '#8b5cf6',
    emoji: '🟣',
    patterns: [/redux/i]
  }
};

class BenchmarkReport {
  constructor(results, filename) {
    this.results = results;
    this.filename = filename;
    this.mode = this.detectMode(filename);
    this.timestamp = new Date().toISOString();
    this.benchmarks = [];
    this.categories = new Map();
    this.frameworks = new Map();
    
    this.processResults();
  }

  detectMode(filename) {
    if (filename.includes('raw')) return 'raw';
    if (filename.includes('real')) return 'real';
    return 'default';
  }

  getFramework(testName) {
    for (const [id, config] of Object.entries(FRAMEWORKS)) {
      if (config.patterns.some(pattern => pattern.test(testName))) {
        return config;
      }
    }
    return { name: 'Other', color: '#6b7280', emoji: '⚪' };
  }

  getCategory(testName, suiteName) {
    // Check suite name first for better context
    const fullContext = `${suiteName} ${testName}`;
    
    for (const [categoryName, config] of Object.entries(TEST_CATEGORIES)) {
      if (config.patterns.some(pattern => pattern.test(fullContext))) {
        return { name: categoryName, ...config };
      }
    }
    
    return { 
      name: 'Other', 
      id: 'other',
      description: 'Uncategorized benchmarks'
    };
  }

  extractTestGroup(testName) {
    // Extract the core operation being tested
    const cleanName = testName
      .replace(/^(Zustand|Redux|React adapter|Lattice)\s*-\s*/i, '')
      .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheses content
      .trim();
    
    return cleanName;
  }

  processResults() {
    let totalDuration = 0;

    this.results.files.forEach(file => {
      file.groups.forEach(group => {
        const suiteName = group.fullName.split(' > ').slice(1).join(' > ');
        
        group.benchmarks.forEach(bench => {
          totalDuration += bench.totalTime;
          
          const framework = this.getFramework(bench.name);
          const category = this.getCategory(bench.name, suiteName);
          const testGroup = this.extractTestGroup(bench.name);
          
          const benchData = {
            id: bench.id,
            name: bench.name,
            suite: suiteName,
            framework: framework,
            category: category,
            testGroup: testGroup,
            mean: bench.mean,
            hz: bench.hz,
            samples: bench.sampleCount,
            rme: bench.rme,
            min: bench.min,
            max: bench.max,
            p75: bench.p75,
            p99: bench.p99,
            p995: bench.p995,
            p999: bench.p999
          };
          
          this.benchmarks.push(benchData);
          
          // Organize by category
          if (!this.categories.has(category.id)) {
            this.categories.set(category.id, {
              ...category,
              benchmarks: [],
              testGroups: new Map()
            });
          }
          
          const cat = this.categories.get(category.id);
          cat.benchmarks.push(benchData);
          
          // Group similar tests together
          if (!cat.testGroups.has(testGroup)) {
            cat.testGroups.set(testGroup, []);
          }
          cat.testGroups.get(testGroup).push(benchData);
          
          // Track framework stats
          if (!this.frameworks.has(framework.name)) {
            this.frameworks.set(framework.name, {
              ...framework,
              benchmarks: [],
              categoryWins: new Map()
            });
          }
          this.frameworks.get(framework.name).benchmarks.push(benchData);
        });
      });
    });
    
    this.totalDuration = totalDuration;
    this.rankBenchmarks();
  }

  rankBenchmarks() {
    // Rank within each test group for fair comparison
    this.categories.forEach(category => {
      category.testGroups.forEach(testGroup => {
        // Sort by performance (lower mean is better)
        const sorted = [...testGroup].sort((a, b) => a.mean - b.mean);
        sorted.forEach((bench, index) => {
          bench.rank = index + 1;
          bench.groupSize = sorted.length;
          
          // Track category wins for frameworks
          if (bench.rank === 1) {
            const framework = this.frameworks.get(bench.framework.name);
            framework.categoryWins.set(category.id, 
              (framework.categoryWins.get(category.id) || 0) + 1
            );
          }
        });
      });
    });
  }

  formatDuration(ms) {
    const ns = ms * 1000000; // Convert ms to ns
    if (ns < 1000) return `${ns.toFixed(2)}ns`;
    if (ns < 1000000) return `${(ns / 1000).toFixed(2)}μs`;
    if (ns < 1000000000) return `${(ns / 1000000).toFixed(2)}ms`;
    return `${(ns / 1000000000).toFixed(2)}s`;
  }

  formatOpsPerSecond(hz) {
    if (hz > 1000000) return `${(hz / 1000000).toFixed(2)}M ops/s`;
    if (hz > 1000) return `${(hz / 1000).toFixed(2)}K ops/s`;
    return `${hz.toFixed(2)} ops/s`;
  }

  generateHTML() {
    const tailwindCDN = 'https://cdn.tailwindcss.com';
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lattice Benchmark Report - ${basename(this.filename)}</title>
  <script src="${tailwindCDN}"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            lattice: '#10b981',
            zustand: '#3b82f6',
            redux: '#8b5cf6'
          }
        }
      }
    }
  </script>
</head>
<body class="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <!-- Header -->
    <header class="mb-8">
      <h1 class="text-4xl font-bold mb-2">
        Lattice Benchmark Report
        ${this.mode === 'raw' ? '<span class="ml-3 text-sm bg-amber-500 text-black px-3 py-1 rounded-full">RAW MODE</span>' : ''}
        ${this.mode === 'real' ? '<span class="ml-3 text-sm bg-green-500 text-white px-3 py-1 rounded-full">REAL MODE</span>' : ''}
      </h1>
      <div class="text-gray-600 dark:text-gray-400">
        <p>Generated: ${new Date(this.timestamp).toLocaleString()}</p>
        <p>File: <code class="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">${this.filename}</code></p>
      </div>
    </header>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Tests</h3>
        <p class="text-3xl font-bold text-blue-600 dark:text-blue-400">${this.benchmarks.length}</p>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Categories</h3>
        <p class="text-3xl font-bold text-green-600 dark:text-green-400">${this.categories.size}</p>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Duration</h3>
        <p class="text-3xl font-bold text-purple-600 dark:text-purple-400">${(this.totalDuration / 1000).toFixed(2)}s</p>
      </div>
    </div>

    <!-- Framework Overview -->
    <section class="mb-12">
      <h2 class="text-2xl font-bold mb-6">Framework Performance Overview</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${Array.from(this.frameworks.entries()).map(([name, framework]) => `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-t-4" style="border-color: ${framework.color}">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold flex items-center gap-2">
              <span class="text-2xl">${framework.emoji}</span>
              ${framework.name}
            </h3>
            <span class="text-sm text-gray-500">${framework.benchmarks.length} tests</span>
          </div>
          <div class="space-y-2">
            <div class="text-sm text-gray-600 dark:text-gray-400">
              <span class="font-medium">Category Wins:</span> ${framework.categoryWins.size}
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              <span class="font-medium">First Place:</span> 
              ${framework.benchmarks.filter(b => b.rank === 1).length} tests
            </div>
          </div>
        </div>
        `).join('')}
      </div>
    </section>

    <!-- Benchmark Results by Category -->
    ${Array.from(this.categories.entries()).map(([categoryId, category]) => `
    <section class="mb-12">
      <div class="mb-6">
        <h2 class="text-2xl font-bold mb-2">${category.name}</h2>
        <p class="text-gray-600 dark:text-gray-400">${category.description}</p>
      </div>
      
      <div class="space-y-8">
        ${Array.from(category.testGroups.entries()).map(([testGroup, benchmarks]) => {
          const sorted = [...benchmarks].sort((a, b) => a.rank - b.rank);
          return `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div class="bg-gray-100 dark:bg-gray-700 px-6 py-4">
            <h3 class="font-semibold text-lg">${testGroup}</h3>
            ${benchmarks.length > 1 ? '<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Comparing ' + benchmarks.length + ' implementations</p>' : ''}
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-gray-750">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rank</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Implementation</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mean Time</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ops/sec</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Samples</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">RME</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                ${sorted.map(bench => `
                <tr class="${bench.rank === 1 ? 'bg-green-50 dark:bg-green-900/20' : ''}">
                  <td class="px-6 py-4 whitespace-nowrap text-center">
                    <span class="text-lg font-bold ${bench.rank === 1 ? 'text-green-600 dark:text-green-400' : bench.rank === 2 ? 'text-blue-600 dark:text-blue-400' : bench.rank === 3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500'}">
                      ${bench.rank === 1 ? '🥇' : bench.rank === 2 ? '🥈' : bench.rank === 3 ? '🥉' : bench.rank}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium">${bench.name}</span>
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white" style="background-color: ${bench.framework.color}">
                        ${bench.framework.name}
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-right font-mono text-sm">${this.formatDuration(bench.mean)}</td>
                  <td class="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">${this.formatOpsPerSecond(bench.hz)}</td>
                  <td class="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">${bench.samples.toLocaleString()}</td>
                  <td class="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400">±${bench.rme.toFixed(2)}%</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${benchmarks.length > 1 && sorted[0].mean > 0 ? `
          <div class="px-6 py-4 bg-gray-50 dark:bg-gray-750">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              <span class="font-medium">${sorted[0].framework.name}</span> is 
              <span class="font-bold text-green-600 dark:text-green-400">${((sorted[sorted.length-1].mean / sorted[0].mean)).toFixed(1)}x faster</span>
              than ${sorted[sorted.length-1].framework.name} for this operation
            </p>
          </div>
          ` : ''}
        </div>
          `;
        }).join('')}
      </div>
    </section>
    `).join('')}

    <!-- Footer -->
    <footer class="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700 text-center text-gray-600 dark:text-gray-400">
      <p>Generated by Lattice Benchmark Suite</p>
    </footer>
  </div>

  <script>
    // Dark mode toggle
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  </script>
</body>
</html>`;

    return html;
  }

  generateMarkdown() {
    let md = `# Lattice Benchmark Report\n\n`;
    
    // Mode indicator
    if (this.mode === 'raw') {
      md += `> 🏷️ **RAW MODE** - Memoization disabled, measuring pure computation performance\n\n`;
    } else if (this.mode === 'real') {
      md += `> 🏷️ **REAL MODE** - Memoization enabled, measuring cached performance\n\n`;
    }
    
    md += `**Generated:** ${new Date(this.timestamp).toLocaleString()}  \n`;
    md += `**File:** \`${this.filename}\`\n\n`;
    
    // Summary
    md += `## Summary\n\n`;
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    md += `| Total Tests | ${this.benchmarks.length} |\n`;
    md += `| Categories | ${this.categories.size} |\n`;
    md += `| Total Duration | ${(this.totalDuration / 1000).toFixed(2)}s |\n\n`;
    
    // Framework Overview
    md += `## Framework Overview\n\n`;
    md += `| Framework | Tests | 1st Place | Category Wins |\n`;
    md += `|-----------|:-----:|:---------:|:-------------:|\n`;
    
    Array.from(this.frameworks.entries())
      .sort((a, b) => b[1].benchmarks.filter(b => b.rank === 1).length - a[1].benchmarks.filter(b => b.rank === 1).length)
      .forEach(([name, framework]) => {
        const firstPlace = framework.benchmarks.filter(b => b.rank === 1).length;
        md += `| ${framework.emoji} ${name} | ${framework.benchmarks.length} | ${firstPlace} | ${framework.categoryWins.size} |\n`;
      });
    
    md += `\n`;
    
    // Results by category
    Array.from(this.categories.entries()).forEach(([categoryId, category]) => {
      md += `## ${category.name}\n\n`;
      md += `> ${category.description}\n\n`;
      
      Array.from(category.testGroups.entries()).forEach(([testGroup, benchmarks]) => {
        const sorted = [...benchmarks].sort((a, b) => a.rank - b.rank);
        
        md += `### ${testGroup}\n\n`;
        
        if (benchmarks.length > 1) {
          md += `Comparing ${benchmarks.length} implementations:\n\n`;
        }
        
        md += `| Rank | Implementation | Framework | Mean Time | Ops/sec | Samples | RME |\n`;
        md += `|:----:|----------------|:---------:|----------:|--------:|--------:|----:|\n`;
        
        sorted.forEach(bench => {
          const rankDisplay = bench.rank === 1 ? '🥇' : bench.rank === 2 ? '🥈' : bench.rank === 3 ? '🥉' : bench.rank;
          md += `| ${rankDisplay} | ${bench.name} | ${bench.framework.emoji} ${bench.framework.name} | ${this.formatDuration(bench.mean)} | ${this.formatOpsPerSecond(bench.hz)} | ${bench.samples.toLocaleString()} | ±${bench.rme.toFixed(2)}% |\n`;
        });
        
        if (benchmarks.length > 1 && sorted[0].mean > 0) {
          const speedup = (sorted[sorted.length-1].mean / sorted[0].mean).toFixed(1);
          md += `\n> **${sorted[0].framework.name}** is **${speedup}x faster** than ${sorted[sorted.length-1].framework.name} for this operation\n`;
        }
        
        md += `\n`;
      });
    });
    
    // Footer
    md += `---\n\n`;
    md += `*Generated by Lattice Benchmark Suite*\n`;
    
    return md;
  }

  generate(format = 'html') {
    switch (format) {
      case 'html':
        return this.generateHTML();
      case 'markdown':
      case 'md':
        return this.generateMarkdown();
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const inputFile = args[0] || 'bench-results.json';
  const outputFormat = args[1] || 'html';
  const outputFile = args[2] || inputFile.replace('.json', `.${outputFormat === 'markdown' ? 'md' : outputFormat}`);
  
  console.log(`Generating ${outputFormat.toUpperCase()} report from ${inputFile}`);
  
  try {
    const results = JSON.parse(readFileSync(inputFile, 'utf-8'));
    const report = new BenchmarkReport(results, inputFile);
    const output = report.generate(outputFormat);
    
    writeFileSync(outputFile, output);
    console.log(`✅ Report generated: ${outputFile}`);
  } catch (error) {
    console.error(`❌ Failed to generate report: ${error.message}`);
    process.exit(1);
  }
}

export { BenchmarkReport };