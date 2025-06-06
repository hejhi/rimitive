#!/usr/bin/env node

/**
 * @fileoverview Performance benchmark dashboard generator
 * 
 * Creates an interactive dashboard that helps developers choose 
 * the right state management solution based on performance characteristics
 */

import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';

// Define meaningful benchmark scenarios
const SCENARIOS = {
  'initial-setup': {
    name: 'Initial Setup Cost',
    description: 'How fast can you create a store and get started?',
    tests: [
      { pattern: /create store.*100 items/i, size: 'small' },
      { pattern: /create store.*1000 items/i, size: 'large' }
    ]
  },
  'single-updates': {
    name: 'Single Item Updates', 
    description: 'Performance when updating individual items',
    tests: [
      { pattern: /sequential updates/i, type: 'sequential' },
      { pattern: /rapid.*changes/i, type: 'rapid' }
    ]
  },
  'bulk-operations': {
    name: 'Bulk Operations',
    description: 'How well does it handle updating many items at once?',
    tests: [
      { pattern: /bulk update/i, type: 'bulk' },
      { pattern: /batched updates/i, type: 'batched' }
    ]
  },
  'computed-values': {
    name: 'Computed Values',
    description: 'Performance of derived state and filtered views',
    tests: [
      { pattern: /filtered view/i, type: 'filter' },
      { pattern: /stats view/i, type: 'aggregation' },
      { pattern: /compute.*view/i, type: 'computation' }
    ]
  },
  'subscriptions': {
    name: 'Subscription Overhead',
    description: 'How does performance scale with many subscribers?',
    tests: [
      { pattern: /\d+ subscriptions/i, type: 'multiple' },
      { pattern: /complex selector/i, type: 'complex' }
    ]
  },
  'real-world': {
    name: 'Real-World Scenarios',
    description: 'Performance in practical application patterns',
    tests: [
      { pattern: /shopping cart|e-commerce/i, type: 'ecommerce' },
      { pattern: /dashboard|metric/i, type: 'dashboard' }
    ]
  }
};

class BenchmarkDashboard {
  constructor(results, filename) {
    this.results = results;
    this.filename = filename;
    this.mode = filename.includes('raw') ? 'raw' : 'real';
    this.benchmarks = [];
    this.scenarios = new Map();
    this.frameworks = new Map();
    
    this.processResults();
  }

  detectFramework(name) {
    if (/zustand/i.test(name)) return { id: 'zustand', name: 'Zustand', color: '#3b82f6' };
    if (/redux/i.test(name)) return { id: 'redux', name: 'Redux', color: '#8b5cf6' };
    if (/lattice|react adapter|core/i.test(name)) return { id: 'lattice', name: 'Lattice', color: '#10b981' };
    return { id: 'other', name: 'Other', color: '#6b7280' };
  }

  normalizeTestName(name) {
    // Extract the core operation, removing framework prefix and parameters
    return name
      .replace(/^(Zustand|Redux|React adapter|Lattice)\s*-\s*/i, '')
      .replace(/\s*\(.*?\)\s*/g, '')
      .toLowerCase()
      .trim();
  }

  processResults() {
    // First pass: collect all benchmarks
    this.results.files.forEach(file => {
      file.groups.forEach(group => {
        group.benchmarks.forEach(bench => {
          const framework = this.detectFramework(bench.name);
          const normalized = this.normalizeTestName(bench.name);
          
          this.benchmarks.push({
            name: bench.name,
            normalized: normalized,
            framework: framework,
            mean: bench.mean,
            hz: bench.hz,
            samples: bench.sampleCount,
            rme: bench.rme
          });

          // Track frameworks
          if (!this.frameworks.has(framework.id)) {
            this.frameworks.set(framework.id, {
              ...framework,
              scores: new Map(),
              wins: 0,
              total: 0
            });
          }
        });
      });
    });

    // Second pass: organize by scenarios
    Object.entries(SCENARIOS).forEach(([scenarioId, scenario]) => {
      const scenarioData = {
        ...scenario,
        comparisons: new Map()
      };

      // Find all tests matching this scenario
      scenario.tests.forEach(testConfig => {
        const matching = this.benchmarks.filter(b => testConfig.pattern.test(b.name));
        
        // Group by normalized operation name
        matching.forEach(bench => {
          const key = `${bench.normalized}_${testConfig.size || testConfig.type || 'default'}`;
          
          if (!scenarioData.comparisons.has(key)) {
            scenarioData.comparisons.set(key, {
              operation: bench.normalized,
              variant: testConfig.size || testConfig.type,
              frameworks: new Map()
            });
          }
          
          scenarioData.comparisons.get(key).frameworks.set(
            bench.framework.id,
            bench
          );
        });
      });

      if (scenarioData.comparisons.size > 0) {
        this.scenarios.set(scenarioId, scenarioData);
      }
    });

    // Calculate rankings and scores
    this.calculateScores();
  }

  calculateScores() {
    this.scenarios.forEach(scenario => {
      scenario.comparisons.forEach(comparison => {
        if (comparison.frameworks.size > 1) {
          // Sort by performance (lower mean is better)
          const sorted = Array.from(comparison.frameworks.entries())
            .sort((a, b) => a[1].mean - b[1].mean);
          
          // Assign scores (winner gets points equal to number of competitors)
          sorted.forEach((entry, index) => {
            const [frameworkId, bench] = entry;
            const framework = this.frameworks.get(frameworkId);
            const score = sorted.length - index;
            
            framework.scores.set(
              scenario.name,
              (framework.scores.get(scenario.name) || 0) + score
            );
            
            framework.total++;
            if (index === 0) framework.wins++;
            
            // Add ranking info to benchmark
            bench.rank = index + 1;
            bench.competitors = sorted.length;
            bench.speedup = index > 0 ? sorted[index][1].mean / sorted[0][1].mean : 1;
          });
        }
      });
    });
  }

  formatDuration(ms) {
    const ns = ms * 1000000;
    if (ns < 1000) return `${ns.toFixed(0)}ns`;
    if (ns < 1000000) return `${(ns / 1000).toFixed(1)}μs`;
    if (ns < 1000000000) return `${(ns / 1000000).toFixed(1)}ms`;
    return `${(ns / 1000000000).toFixed(2)}s`;
  }

  generateHTML() {
    const chartColors = {
      lattice: 'rgb(16, 185, 129)',
      zustand: 'rgb(59, 130, 246)',
      redux: 'rgb(139, 92, 246)'
    };

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>State Management Performance Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    .chart-container { position: relative; height: 300px; }
  </style>
</head>
<body class="bg-gray-50 text-gray-900">
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <!-- Header -->
    <header class="mb-12 text-center">
      <h1 class="text-4xl font-bold mb-4">State Management Performance Dashboard</h1>
      <p class="text-xl text-gray-600 mb-2">Choose the right state manager based on your performance needs</p>
      <div class="inline-flex items-center gap-2 text-sm bg-amber-100 text-amber-800 px-4 py-2 rounded-full">
        <span class="font-semibold">${this.mode === 'raw' ? 'Raw Performance' : 'Real-World Performance'}</span>
        <span>${this.mode === 'raw' ? '(without memoization)' : '(with memoization)'}</span>
      </div>
    </header>

    <!-- Overall Winner -->
    <section class="mb-12">
      <div class="bg-white rounded-xl shadow-lg p-8">
        <h2 class="text-2xl font-bold mb-6 text-center">Overall Performance Leader</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${Array.from(this.frameworks.entries())
            .sort((a, b) => b[1].wins - a[1].wins)
            .map((entry, index) => {
              const [id, framework] = entry;
              const winRate = framework.total > 0 ? (framework.wins / framework.total * 100).toFixed(0) : 0;
              return `
          <div class="text-center ${index === 0 ? 'transform scale-110' : ''}">
            <div class="inline-block p-6 rounded-full mb-4" style="background-color: ${framework.color}20">
              <div class="text-4xl font-bold" style="color: ${framework.color}">
                ${index === 0 ? '🏆' : index === 1 ? '🥈' : '🥉'}
              </div>
            </div>
            <h3 class="text-xl font-bold mb-2">${framework.name}</h3>
            <p class="text-3xl font-bold mb-1" style="color: ${framework.color}">${winRate}%</p>
            <p class="text-sm text-gray-600">win rate</p>
            <p class="text-xs text-gray-500 mt-2">${framework.wins} wins / ${framework.total} tests</p>
          </div>
              `;
            }).join('')}
        </div>
      </div>
    </section>

    <!-- Performance by Scenario -->
    <section class="mb-12">
      <h2 class="text-3xl font-bold mb-8">Performance by Use Case</h2>
      <div class="grid gap-8">
        ${Array.from(this.scenarios.entries()).map(([scenarioId, scenario]) => {
          // Prepare data for charts
          const comparisons = Array.from(scenario.comparisons.values())
            .filter(c => c.frameworks.size > 1);
          
          if (comparisons.length === 0) return '';
          
          const chartId = `chart-${scenarioId}`;
          const chartData = this.prepareChartData(comparisons);
          
          return `
        <div class="bg-white rounded-xl shadow-lg p-8">
          <h3 class="text-2xl font-bold mb-2">${scenario.name}</h3>
          <p class="text-gray-600 mb-6">${scenario.description}</p>
          
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Chart -->
            <div class="chart-container">
              <canvas id="${chartId}"></canvas>
            </div>
            
            <!-- Detailed Results -->
            <div class="space-y-4">
              ${comparisons.map(comparison => {
                const sorted = Array.from(comparison.frameworks.entries())
                  .sort((a, b) => a[1].mean - b[1].mean);
                const winner = sorted[0];
                
                return `
              <div class="border rounded-lg p-4">
                <h4 class="font-semibold mb-2">
                  ${comparison.operation}
                  ${comparison.variant !== 'default' ? `(${comparison.variant})` : ''}
                </h4>
                <div class="space-y-2">
                  ${sorted.map(([fwId, bench], idx) => `
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="text-lg">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                      <span class="font-medium">${bench.framework.name}</span>
                    </div>
                    <div class="text-right">
                      <span class="font-mono text-sm">${this.formatDuration(bench.mean)}</span>
                      ${idx > 0 ? `<span class="text-xs text-gray-500 ml-2">(${bench.speedup.toFixed(1)}x slower)</span>` : ''}
                    </div>
                  </div>
                  `).join('')}
                </div>
              </div>
                `;
              }).join('')}
            </div>
          </div>
          
          <!-- Scenario Winner -->
          <div class="mt-6 p-4 bg-gray-50 rounded-lg">
            <p class="text-sm">
              <span class="font-semibold">Best for ${scenario.name.toLowerCase()}:</span>
              ${this.getScenarioWinner(scenario)}
            </p>
          </div>
        </div>
        
        <script>
          // Render chart for ${scenarioId}
          (function() {
            const ctx = document.getElementById('${chartId}').getContext('2d');
            const data = ${JSON.stringify(chartData)};
            
            new Chart(ctx, {
              type: 'bar',
              data: {
                labels: data.labels,
                datasets: [
                  {
                    label: 'Lattice',
                    data: data.lattice,
                    backgroundColor: '${chartColors.lattice}',
                  },
                  {
                    label: 'Zustand',
                    data: data.zustand,
                    backgroundColor: '${chartColors.zustand}',
                  },
                  {
                    label: 'Redux',
                    data: data.redux,
                    backgroundColor: '${chartColors.redux}',
                  }
                ]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: 'Time (lower is better)'
                    }
                  }
                },
                plugins: {
                  tooltip: {
                    callbacks: {
                      label: function(context) {
                        const value = context.parsed.y;
                        if (value < 0.001) return context.dataset.label + ': ' + (value * 1000000).toFixed(0) + 'ns';
                        if (value < 1) return context.dataset.label + ': ' + (value * 1000).toFixed(1) + 'μs';
                        return context.dataset.label + ': ' + value.toFixed(1) + 'ms';
                      }
                    }
                  }
                }
              }
            });
          })();
        </script>
          `;
        }).join('')}
      </div>
    </section>

    <!-- Recommendations -->
    <section class="mb-12">
      <h2 class="text-3xl font-bold mb-8">Recommendations</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${this.generateRecommendations().map(rec => `
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold mb-2" style="color: ${this.frameworks.get(rec.framework).color}">
            Use ${this.frameworks.get(rec.framework).name} when:
          </h3>
          <ul class="space-y-2">
            ${rec.reasons.map(reason => `
            <li class="flex items-start gap-2">
              <span class="text-green-500 mt-0.5">✓</span>
              <span class="text-gray-700">${reason}</span>
            </li>
            `).join('')}
          </ul>
        </div>
        `).join('')}
      </div>
    </section>

    <!-- Footer -->
    <footer class="mt-16 pt-8 border-t text-center text-gray-600">
      <p>Performance data from ${this.benchmarks.length} benchmarks</p>
      <p class="text-sm mt-2">Lower times are better. Results may vary based on hardware and use case.</p>
    </footer>
  </div>
</body>
</html>`;

    return html;
  }

  prepareChartData(comparisons) {
    const labels = comparisons.map(c => 
      c.operation + (c.variant !== 'default' ? ` (${c.variant})` : '')
    );
    
    const data = {
      labels,
      lattice: [],
      zustand: [],
      redux: []
    };
    
    comparisons.forEach(comparison => {
      ['lattice', 'zustand', 'redux'].forEach(fw => {
        const bench = comparison.frameworks.get(fw);
        data[fw].push(bench ? bench.mean : null);
      });
    });
    
    return data;
  }

  getScenarioWinner(scenario) {
    const scores = new Map();
    
    scenario.comparisons.forEach(comparison => {
      const sorted = Array.from(comparison.frameworks.entries())
        .sort((a, b) => a[1].mean - b[1].mean);
      
      if (sorted.length > 0) {
        const winner = sorted[0][0];
        scores.set(winner, (scores.get(winner) || 0) + 1);
      }
    });
    
    const winner = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (winner) {
      const framework = this.frameworks.get(winner[0]);
      return `<span style="color: ${framework.color}" class="font-bold">${framework.name}</span>`;
    }
    
    return 'No clear winner';
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Analyze each framework's strengths
    this.frameworks.forEach((framework, id) => {
      const strengths = [];
      
      // Check where each framework excels
      this.scenarios.forEach(scenario => {
        let wins = 0;
        let total = 0;
        
        scenario.comparisons.forEach(comparison => {
          if (comparison.frameworks.has(id)) {
            total++;
            const sorted = Array.from(comparison.frameworks.entries())
              .sort((a, b) => a[1].mean - b[1].mean);
            if (sorted[0][0] === id) wins++;
          }
        });
        
        if (total > 0 && wins / total > 0.5) {
          strengths.push(scenario.name.toLowerCase());
        }
      });
      
      // Generate specific recommendations
      const rec = { framework: id, reasons: [] };
      
      if (strengths.includes('initial setup cost')) {
        rec.reasons.push('You need fast store initialization');
      }
      if (strengths.includes('single item updates')) {
        rec.reasons.push('Your app has frequent individual state changes');
      }
      if (strengths.includes('bulk operations')) {
        rec.reasons.push('You often update many items at once');
      }
      if (strengths.includes('computed values')) {
        rec.reasons.push('You rely heavily on derived state');
      }
      if (strengths.includes('subscription overhead')) {
        rec.reasons.push('You have many components subscribing to state');
      }
      if (strengths.includes('real-world scenarios')) {
        rec.reasons.push('You\'re building typical web applications');
      }
      
      if (rec.reasons.length > 0) {
        recommendations.push(rec);
      }
    });
    
    return recommendations;
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const inputFile = process.argv[2] || 'bench-results.json';
  const outputFile = process.argv[3] || inputFile.replace('.json', '-dashboard.html');
  
  console.log(`📊 Generating performance dashboard from ${inputFile}`);
  
  try {
    const results = JSON.parse(readFileSync(inputFile, 'utf-8'));
    const dashboard = new BenchmarkDashboard(results, inputFile);
    const html = dashboard.generateHTML();
    
    writeFileSync(outputFile, html);
    console.log(`✅ Dashboard generated: ${outputFile}`);
  } catch (error) {
    console.error(`❌ Failed to generate dashboard: ${error.message}`);
    process.exit(1);
  }
}

export { BenchmarkDashboard };