/**
 * Filtered Diamond Pattern Tracing Test
 * 
 * This test reproduces the filtered diamond pattern from the benchmark
 * and traces execution to understand why Lattice might be slower than Preact.
 * 
 * Pattern:
 *        source
 *        /    \
 *    filterA  filterB  (only pass values > 50)
 *        \    /
 *      expensive
 */

import { describe, it, expect } from 'vitest';
import { 
  createSignalAPI,
  createSignalFactory,
  createComputedFactory,
  createEffectFactory
} from '../index';
import { CONSTANTS } from '../constants';

const { NOTIFIED } = CONSTANTS;

// Create API instance
const { signal, computed } = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  effect: createEffectFactory
});

describe('Filtered Diamond Pattern Tracing', () => {
  it('should trace execution when values are filtered (10 to 20)', () => {
    const executionLog: string[] = [];
    let filterAExecutions = 0;
    let filterBExecutions = 0;
    let expensiveExecutions = 0;
    let dependencyChecks = 0;

    // Create the diamond pattern
    const source = signal(10);
    
    const filterA = computed(() => {
      filterAExecutions++;
      const val = source.value;
      executionLog.push(`filterA: reading source (${val}), returning ${val > 50 ? val * 2 : 0}`);
      return val > 50 ? val * 2 : 0;
    });
    
    const filterB = computed(() => {
      filterBExecutions++;
      const val = source.value;
      executionLog.push(`filterB: reading source (${val}), returning ${val > 50 ? val * 3 : 0}`);
      return val > 50 ? val * 3 : 0;
    });
    
    const expensive = computed(() => {
      expensiveExecutions++;
      const a = filterA.value;
      const b = filterB.value;
      executionLog.push(`expensive: reading filterA (${a}) and filterB (${b})`);
      
      // Simulate expensive computation
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += i;
      }
      return a + b + sum;
    });

    // Initial read to establish dependencies
    executionLog.push('=== Initial read ===');
    const initial = expensive.value;
    expect(initial).toBe(4950); // 0 + 0 + sum(0..99)
    
    // Log initial state
    executionLog.push(`Initial executions: filterA=${filterAExecutions}, filterB=${filterBExecutions}, expensive=${expensiveExecutions}`);
    executionLog.push(`filterA flags: ${(filterA as any)._flags}, version: ${(filterA as any)._version}`);
    executionLog.push(`filterB flags: ${(filterB as any)._flags}, version: ${(filterB as any)._version}`);
    executionLog.push(`expensive flags: ${(expensive as any)._flags}, version: ${(expensive as any)._version}`);
    
    // Reset counters
    filterAExecutions = 0;
    filterBExecutions = 0;
    expensiveExecutions = 0;
    
    // Change source from 10 to 20 (both still filtered)
    executionLog.push('\n=== Changing source from 10 to 20 ===');
    source.value = 20;
    
    // Log flags after source change (before read)
    executionLog.push('After source change (before read):');
    executionLog.push(`filterA flags: ${(filterA as any)._flags} (${(filterA as any)._flags & NOTIFIED ? 'NOTIFIED' : 'not notified'})`);
    executionLog.push(`filterB flags: ${(filterB as any)._flags} (${(filterB as any)._flags & NOTIFIED ? 'NOTIFIED' : 'not notified'})`);
    executionLog.push(`expensive flags: ${(expensive as any)._flags} (${(expensive as any)._flags & NOTIFIED ? 'NOTIFIED' : 'not notified'})`);
    
    // Hook into dependency checking
    const originalUpdate = (expensive as any)._update;
    (expensive as any)._update = function() {
      executionLog.push('expensive._update called');
      dependencyChecks++;
      return originalUpdate.call(this);
    };
    
    // Read expensive value
    executionLog.push('\n=== Reading expensive value ===');
    const afterChange = expensive.value;
    expect(afterChange).toBe(4950); // Should be same since both values still filtered
    
    // Log what happened
    executionLog.push(`\nExecutions after change: filterA=${filterAExecutions}, filterB=${filterBExecutions}, expensive=${expensiveExecutions}`);
    executionLog.push(`Dependency checks: ${dependencyChecks}`);
    
    // Now test with a value that passes the filter
    executionLog.push('\n=== Changing source to 60 (passes filter) ===');
    filterAExecutions = 0;
    filterBExecutions = 0;
    expensiveExecutions = 0;
    dependencyChecks = 0;
    
    source.value = 60;
    
    executionLog.push('After source change (before read):');
    executionLog.push(`filterA flags: ${(filterA as any)._flags} (${(filterA as any)._flags & NOTIFIED ? 'NOTIFIED' : 'not notified'})`);
    executionLog.push(`filterB flags: ${(filterB as any)._flags} (${(filterB as any)._flags & NOTIFIED ? 'NOTIFIED' : 'not notified'})`);
    executionLog.push(`expensive flags: ${(expensive as any)._flags} (${(expensive as any)._flags & NOTIFIED ? 'NOTIFIED' : 'not notified'})`);
    
    const afterPass = expensive.value;
    expect(afterPass).toBe(120 + 180 + 4950); // 60*2 + 60*3 + sum
    
    executionLog.push(`\nExecutions with passing value: filterA=${filterAExecutions}, filterB=${filterBExecutions}, expensive=${expensiveExecutions}`);
    
    // Print full log
    console.log('\n=== EXECUTION TRACE ===');
    executionLog.forEach(log => console.log(log));
  });

  it('should trace multiple filtered updates (mostly filtered scenario)', () => {
    const executionLog: string[] = [];
    const executionCounts = {
      filterA: 0,
      filterB: 0,
      expensive: 0,
      refreshCalls: 0,
      dependencyChecks: 0
    };

    // Create the diamond pattern with tracing
    const source = signal(0);
    
    const filterA = computed(() => {
      executionCounts.filterA++;
      const val = source.value;
      return val > 50 ? val * 2 : 0;
    });
    
    const filterB = computed(() => {
      executionCounts.filterB++;
      const val = source.value;
      return val > 50 ? val * 3 : 0;
    });
    
    const expensive = computed(() => {
      executionCounts.expensive++;
      const a = filterA.value;
      const b = filterB.value;
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += i;
      }
      return a + b + sum;
    });

    // Hook into _refresh to see when it's called
    const originalRefreshA = (filterA as any)._refresh;
    const originalRefreshB = (filterB as any)._refresh;
    
    (filterA as any)._refresh = function() {
      executionCounts.refreshCalls++;
      executionLog.push(`filterA._refresh called (version: ${this._version})`);
      return originalRefreshA.call(this);
    };
    
    (filterB as any)._refresh = function() {
      executionCounts.refreshCalls++;
      executionLog.push(`filterB._refresh called (version: ${this._version})`);
      return originalRefreshB.call(this);
    };

    // Initial read
    expensive.value;
    
    // Reset counters
    Object.keys(executionCounts).forEach(key => executionCounts[key as keyof typeof executionCounts] = 0);
    
    // Simulate the "mostly filtered" scenario from benchmark
    // 90% values < 50 (filtered), 10% > 50 (pass through)
    const updates = [10, 20, 30, 40, 45, 90, 15, 25, 35, 95];
    
    executionLog.push('=== Starting mostly filtered updates ===');
    
    updates.forEach((val, i) => {
      executionLog.push(`\nUpdate ${i}: source = ${val} (${val > 50 ? 'PASSES' : 'FILTERED'})`);
      source.value = val;
      
      // Check flags before read
      const filterAFlags = (filterA as any)._flags;
      const filterBFlags = (filterB as any)._flags;
      const expensiveFlags = (expensive as any)._flags;
      
      executionLog.push(`  Pre-read flags: filterA=${filterAFlags & NOTIFIED ? 'NOTIFIED' : 'clean'}, filterB=${filterBFlags & NOTIFIED ? 'NOTIFIED' : 'clean'}, expensive=${expensiveFlags & NOTIFIED ? 'NOTIFIED' : 'clean'}`);
      
      // Read value
      const beforeCounts = { ...executionCounts };
      expensive.value;
      
      // Log what executed
      const changes = [];
      if (executionCounts.filterA > beforeCounts.filterA) changes.push('filterA');
      if (executionCounts.filterB > beforeCounts.filterB) changes.push('filterB');
      if (executionCounts.expensive > beforeCounts.expensive) changes.push('expensive');
      if (executionCounts.refreshCalls > beforeCounts.refreshCalls) changes.push(`${executionCounts.refreshCalls - beforeCounts.refreshCalls} refresh calls`);
      
      executionLog.push(`  Executed: ${changes.length ? changes.join(', ') : 'NOTHING'}`);
    });
    
    // Summary
    executionLog.push('\n=== SUMMARY ===');
    executionLog.push(`Total executions: filterA=${executionCounts.filterA}, filterB=${executionCounts.filterB}, expensive=${executionCounts.expensive}`);
    executionLog.push(`Total refresh calls: ${executionCounts.refreshCalls}`);
    executionLog.push(`Average refresh calls per update: ${executionCounts.refreshCalls / updates.length}`);
    
    // Print log
    console.log('\n=== MOSTLY FILTERED TRACE ===');
    executionLog.forEach(log => console.log(log));
  });

  it('should compare with expected optimal behavior', () => {
    // Test to verify the expected behavior for filtered diamond
    const source = signal(10);
    const filterA = computed(() => source.value > 50 ? source.value * 2 : 0);
    const filterB = computed(() => source.value > 50 ? source.value * 3 : 0);
    const expensive = computed(() => {
      const a = filterA.value;
      const b = filterB.value;
      let sum = 0;
      for (let i = 0; i < 100; i++) sum += i;
      return a + b + sum;
    });

    // Initial read
    expect(expensive.value).toBe(4950);
    
    // Track versions
    const getVersions = () => ({
      filterA: (filterA as any)._version,
      filterB: (filterB as any)._version,
      expensive: (expensive as any)._version
    });
    
    const v1 = getVersions();
    console.log('Initial versions:', v1);
    
    // Change to another filtered value
    source.value = 20;
    expensive.value;
    const v2 = getVersions();
    console.log('After filtered change:', v2);
    console.log('Version changes:', {
      filterA: v2.filterA - v1.filterA,
      filterB: v2.filterB - v1.filterB,
      expensive: v2.expensive - v1.expensive
    });
    
    // Change to passing value
    source.value = 60;
    expensive.value;
    const v3 = getVersions();
    console.log('After passing change:', v3);
    console.log('Version changes:', {
      filterA: v3.filterA - v2.filterA,
      filterB: v3.filterB - v2.filterB,
      expensive: v3.expensive - v2.expensive
    });
  });
});