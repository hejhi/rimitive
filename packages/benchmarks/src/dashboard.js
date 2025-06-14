export class BenchmarkDashboard {
  constructor() {
    this.currentRun1 = null;
    this.currentRun2 = null;
    this.currentBenchmark = 'adapter-rankings';
    this.availableRuns = [];
  }

  async init() {
    this.setupEventListeners();
    await this.loadRuns();
  }

  setupEventListeners() {
    document.getElementById('run1Select').addEventListener('change', (e) => {
      this.currentRun1 = e.target.value;
      this.loadBenchmarkData();
    });

    document.getElementById('run2Select').addEventListener('change', (e) => {
      this.currentRun2 = e.target.value;
      this.loadBenchmarkData();
    });

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        this.currentBenchmark = e.target.dataset.benchmark;
        this.loadBenchmarkData();
      });
    });
  }

  async loadRuns() {
    try {
      // In Vite, files in publicDir (dist) are served from root
      const basePath = '/benchmarks';
      const availableRuns = [];
      
      // List of potential runs - we'll check which ones actually exist
      const potentialRuns = [
        'baseline-real',
        '2025-06-14T01-21-17',
        '2025-06-14T01-01-10',
        '2025-06-13T17-41-29',
        '2025-06-13T17-38-03',
        '2025-06-13T17-26-11',
        '2025-06-13T16-20-44',
        '2025-06-13T16-13-41',
        '2025-06-13T13-20-34',
        '2025-06-12T18-08-41'
      ];

      // Check each potential run to see if it has real benchmark files
      for (const run of potentialRuns) {
        try {
          const response = await fetch(`${basePath}/${run}/adapter-rankings-real.json`);
          if (response.ok) {
            availableRuns.push(run);
          }
        } catch (e) {
          // Skip runs that don't exist
        }
      }

      this.availableRuns = availableRuns;
      this.updateRunSelectors();

      // Auto-select runs
      if (this.availableRuns.length > 0) {
        document.getElementById('run1Select').value = this.availableRuns[0];
        this.currentRun1 = this.availableRuns[0];
        
        if (this.availableRuns.length > 1) {
          document.getElementById('run2Select').value = this.availableRuns[1];
          this.currentRun2 = this.availableRuns[1];
        }
        
        await this.loadBenchmarkData();
      }
    } catch (error) {
      console.error('Failed to load runs:', error);
    }
  }

  updateRunSelectors() {
    const run1Select = document.getElementById('run1Select');
    const run2Select = document.getElementById('run2Select');
    
    run1Select.innerHTML = '<option value="">Select a run...</option>';
    run2Select.innerHTML = '<option value="">None (no comparison)</option>';
    
    this.availableRuns.forEach(run => {
      const option1 = new Option(this.formatRunName(run), run);
      const option2 = new Option(this.formatRunName(run), run);
      run1Select.add(option1);
      run2Select.add(option2);
    });
  }

  formatRunName(run) {
    if (run === 'baseline-real') return 'Baseline';
    
    // Parse the custom date format: YYYY-MM-DDTHH-MM-SS
    const match = run.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
    if (match) {
      const [_, year, month, day, hour, minute, second] = match;
      const date = new Date(year, month - 1, day, hour, minute, second);
      return date.toLocaleString();
    }
    return run;
  }

  async loadBenchmarkData() {
    const content = document.getElementById('benchmarkContent');
    
    if (!this.currentRun1) {
      content.innerHTML = '<div class="error">Please select a run to view</div>';
      return;
    }
    
    content.innerHTML = '<div class="loading">Loading benchmark data...</div>';
    
    try {
      const data1 = await this.loadRunData(this.currentRun1, this.currentBenchmark);
      const data2 = this.currentRun2 ? await this.loadRunData(this.currentRun2, this.currentBenchmark) : null;
      
      this.displayBenchmarkData(data1, data2);
    } catch (error) {
      content.innerHTML = `<div class="error">Failed to load benchmark data: ${error.message}</div>`;
    }
  }

  async loadRunData(run, benchmark) {
    const response = await fetch(`/benchmarks/${run}/${benchmark}-real.json`);
    if (!response.ok) {
      throw new Error(`Failed to load ${benchmark} for ${run}`);
    }
    return await response.json();
  }

  displayBenchmarkData(data1, data2) {
    const content = document.getElementById('benchmarkContent');
    
    // Extract benchmarks from the nested structure
    const benchmarks = [];
    if (data1.files && data1.files.length > 0) {
      data1.files.forEach(file => {
        if (file.groups) {
          file.groups.forEach(group => {
            if (group.benchmarks) {
              benchmarks.push(...group.benchmarks);
            }
          });
        }
      });
    }
    
    if (benchmarks.length === 0) {
      content.innerHTML = '<div class="error">No benchmark data found</div>';
      return;
    }
    
    // Group benchmarks by their original groups
    const suites = {};
    if (data1.files && data1.files.length > 0) {
      data1.files.forEach(file => {
        if (file.groups) {
          file.groups.forEach(group => {
            const suiteName = group.fullName.split(' > ').slice(-1)[0] || 'Default';
            if (!suites[suiteName]) suites[suiteName] = [];
            if (group.benchmarks) {
              suites[suiteName].push(...group.benchmarks);
            }
          });
        }
      });
    }
    
    let html = '';
    
    // Summary comparison grid for adapter benchmarks
    if (this.currentBenchmark === 'adapter-rankings' || this.currentBenchmark === 'overhead') {
      html += this.createAdapterComparison(benchmarks, data2);
    }
    
    // Display each suite
    Object.entries(suites).forEach(([suiteName, tests]) => {
      html += `<div class="test-group">`;
      html += `<h4>${suiteName}</h4>`;
      html += `<div class="test-results">`;
      html += `<table>`;
      html += `<thead><tr>`;
      html += `<th>Test</th>`;
      html += `<th>Mean (ms)</th>`;
      html += `<th>Ops/sec</th>`;
      html += `<th>Samples</th>`;
      if (data2) {
        html += `<th>vs Run 2</th>`;
      }
      html += `</tr></thead>`;
      html += `<tbody>`;
      
      tests.forEach(test => {
        const mean = test.mean || 0;
        const ops = test.hz || 0;
        const samples = test.sampleCount || test.samples || 0;
        
        // Find comparison data
        let comparison = null;
        if (data2) {
          // Extract benchmarks from data2
          const benchmarks2 = [];
          if (data2.files && data2.files.length > 0) {
            data2.files.forEach(file => {
              if (file.groups) {
                file.groups.forEach(group => {
                  if (group.benchmarks) {
                    benchmarks2.push(...group.benchmarks);
                  }
                });
              }
            });
          }
          
          const prevTest = benchmarks2.find(b => b.name === test.name);
          if (prevTest && prevTest.mean) {
            const prevMean = prevTest.mean;
            const change = ((mean - prevMean) / prevMean * 100).toFixed(1);
            const changeClass = change < 0 ? 'positive' : change > 0 ? 'negative' : 'neutral';
            comparison = `<span class="${changeClass}">${change > 0 ? '+' : ''}${change}%</span>`;
          }
        }
        
        html += `<tr>`;
        html += `<td>${test.name}</td>`;
        html += `<td>${this.formatNumber(mean)}</td>`;
        html += `<td>${this.formatNumber(ops)}</td>`;
        html += `<td>${samples}</td>`;
        if (data2) {
          html += `<td>${comparison || '-'}</td>`;
        }
        html += `</tr>`;
      });
      
      html += `</tbody></table>`;
      html += `</div></div>`;
    });
    
    content.innerHTML = html;
  }

  createAdapterComparison(benchmarks, comparisonData) {
    const adapters = {};
    
    // Group by adapter
    benchmarks.forEach(bench => {
      // Try different name patterns
      let adapter = null;
      
      // Pattern 1: "adapter-name: test name"
      const colonMatch = bench.name.match(/^([\w-]+):/);
      if (colonMatch) {
        adapter = colonMatch[1];
      } else {
        // Pattern 2: "adapter-name adapter - test name" or "adapter-name - test name"
        const dashMatch = bench.name.match(/^([\w-]+)\s+(?:adapter\s+)?-\s+/);
        if (dashMatch) {
          adapter = dashMatch[1];
        }
      }
      
      if (adapter) {
        if (!adapters[adapter]) adapters[adapter] = [];
        adapters[adapter].push(bench);
      }
    });
    
    let html = '<div class="comparison-grid">';
    
    // Find best performer for each metric
    const metricWinners = {};
    Object.entries(adapters).forEach(([adapter, tests]) => {
      tests.forEach(test => {
        // Extract metric name from different patterns
        let metricName = null;
        
        // Pattern 1: "adapter: metric"
        if (test.name.includes(':')) {
          metricName = test.name.split(':')[1]?.trim();
        } else if (test.name.includes(' - ')) {
          // Pattern 2: "adapter adapter - metric" or "adapter - metric"
          metricName = test.name.split(' - ').slice(1).join(' - ').trim();
        }
        
        if (metricName) {
          if (!metricWinners[metricName] || test.hz > metricWinners[metricName].hz) {
            metricWinners[metricName] = { adapter, hz: test.hz };
          }
        }
      });
    });
    
    Object.entries(adapters).forEach(([adapter, tests]) => {
      const isOverallWinner = Object.values(metricWinners).filter(w => w.adapter === adapter).length > 
                             Object.values(metricWinners).length / 2;
      
      html += `<div class="adapter-card ${isOverallWinner ? 'winner' : ''}">`;
      html += `<h3>${adapter}</h3>`;
      
      tests.forEach(test => {
        // Extract metric name
        let metricName = test.name;
        if (test.name.includes(':')) {
          metricName = test.name.split(':')[1]?.trim();
        } else if (test.name.includes(' - ')) {
          metricName = test.name.split(' - ').slice(1).join(' - ').trim();
        }
        
        const isWinner = metricWinners[metricName]?.adapter === adapter;
        
        html += `<div class="metric">`;
        html += `<span class="metric-name">${metricName}</span>`;
        html += `<span class="metric-value ${isWinner ? 'positive' : ''}">${this.formatNumber(test.hz)} ops/s</span>`;
        html += `</div>`;
        
        // Performance bar
        const maxHz = Math.max(...Object.values(adapters).flat().map(t => t.hz || 0));
        const percentage = (test.hz / maxHz * 100) || 0;
        html += `<div class="performance-bar">`;
        html += `<div class="performance-fill" style="width: ${percentage}%"></div>`;
        html += `</div>`;
      });
      
      html += `</div>`;
    });
    
    html += '</div>';
    return html;
  }

  formatNumber(num) {
    if (num > 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    if (num > 1) {
      return num.toFixed(2);
    }
    return num.toFixed(4);
  }
}