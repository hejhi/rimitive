/**
 * Filtered Diamond Optimization Analysis
 * 
 * This test analyzes the optimization opportunity in the filtered diamond pattern.
 * The key question: When intermediate computeds don't change their output value,
 * should we still execute downstream computeds to check?
 */

import { describe, it } from 'vitest';
import { 
  createSignalAPI,
  createSignalFactory,
  createComputedFactory,
  createEffectFactory
} from '../index';

// Create API instance
const { signal, computed } = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  effect: createEffectFactory
});

describe('Filtered Diamond Optimization Analysis', () => {
  it('should analyze execution patterns in deep filtered chains', () => {
    const executionCounts = {
      level1: 0,
      level2: 0,
      level3: 0,
      level4: 0,
      level5: 0
    };
    
    // Create a deep chain with filtering at each level
    const source = signal(10);
    
    const level1 = computed(() => {
      executionCounts.level1++;
      const val = source.value;
      return val > 50 ? val : 0; // Filter: only pass > 50
    });
    
    const level2 = computed(() => {
      executionCounts.level2++;
      const val = level1.value;
      return val > 0 ? val * 2 : 0; // Only compute if level1 passed
    });
    
    const level3 = computed(() => {
      executionCounts.level3++;
      const val = level2.value;
      return val > 0 ? val + 100 : 0; // Only compute if level2 passed
    });
    
    const level4 = computed(() => {
      executionCounts.level4++;
      const val = level3.value;
      return val > 0 ? Math.sqrt(val) : 0; // Only compute if level3 passed
    });
    
    const level5 = computed(() => {
      executionCounts.level5++;
      const val = level4.value;
      // Expensive computation
      let result = 0;
      for (let i = 0; i < 1000; i++) {
        result += Math.sin(val + i);
      }
      return result;
    });
    
    // Initial read
    level5.value;
    console.log('Initial execution counts:', { ...executionCounts });
    
    // Reset counts
    Object.keys(executionCounts).forEach(key => executionCounts[key as keyof typeof executionCounts] = 0);
    
    // Test filtered updates
    console.log('\n=== Testing filtered updates (10 -> 20 -> 30 -> 40) ===');
    const filteredUpdates = [20, 30, 40];
    
    filteredUpdates.forEach(val => {
      source.value = val;
      level5.value;
      console.log(`After update to ${val}:`, { ...executionCounts });
      Object.keys(executionCounts).forEach(key => executionCounts[key as keyof typeof executionCounts] = 0);
    });
    
    // Test passing update
    console.log('\n=== Testing passing update (40 -> 60) ===');
    source.value = 60;
    level5.value;
    console.log('After update to 60:', { ...executionCounts });
  });

  it('should measure actual cost of intermediate recomputations', () => {
    // Simulate more realistic filtering computeds with actual work
    const executionTimes: number[] = [];
    
    const source = signal({ data: Array.from({ length: 100 }, (_, i) => i), threshold: 50 });
    
    const filtered = computed(() => {
      const start = performance.now();
      const { data, threshold } = source.value;
      
      // Simulate some work: filter and transform
      const result = data
        .filter(x => x > threshold)
        .map(x => x * x)
        .reduce((sum, x) => sum + x, 0);
      
      const time = performance.now() - start;
      executionTimes.push(time);
      
      // Return 0 if no items pass filter, otherwise return sum
      return result || 0;
    });
    
    const expensive = computed(() => {
      const val = filtered.value;
      if (val === 0) return 0;
      
      // Simulate expensive computation only if we have data
      let result = 0;
      for (let i = 0; i < 10000; i++) {
        result += Math.sqrt(val + i);
      }
      return result;
    });
    
    // Initial read
    expensive.value;
    
    // Update threshold multiple times (all filtering out everything)
    console.log('\n=== Cost of intermediate computations ===');
    for (let threshold = 101; threshold <= 110; threshold++) {
      source.value = { ...source.value, threshold };
      expensive.value;
    }
    
    const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
    console.log(`Average time for filtered computed: ${avgTime.toFixed(3)}ms`);
    console.log(`Total wasted time: ${(avgTime * 10).toFixed(3)}ms for 10 updates`);
  });

  it('should demonstrate the diamond multiplication effect', () => {
    // In a diamond, multiple intermediate nodes all recompute
    const counts = {
      pathA: 0,
      pathB: 0,
      pathC: 0,
      pathD: 0,
      diamond: 0
    };
    
    const source = signal(10);
    
    // Four paths that all filter
    const pathA = computed(() => {
      counts.pathA++;
      return source.value > 50 ? source.value * 2 : 0;
    });
    
    const pathB = computed(() => {
      counts.pathB++;
      return source.value > 50 ? source.value * 3 : 0;
    });
    
    const pathC = computed(() => {
      counts.pathC++;
      return source.value > 50 ? source.value * 4 : 0;
    });
    
    const pathD = computed(() => {
      counts.pathD++;
      return source.value > 50 ? source.value * 5 : 0;
    });
    
    // Diamond that depends on all paths
    const diamond = computed(() => {
      counts.diamond++;
      return pathA.value + pathB.value + pathC.value + pathD.value;
    });
    
    // Initial
    diamond.value;
    
    // Reset
    Object.keys(counts).forEach(key => counts[key as keyof typeof counts] = 0);
    
    // Update with filtered values
    console.log('\n=== Diamond multiplication effect ===');
    for (let i = 11; i <= 20; i++) {
      source.value = i;
      diamond.value;
    }
    
    console.log('Total executions after 10 filtered updates:', counts);
    console.log(`Intermediate computations: ${counts.pathA + counts.pathB + counts.pathC + counts.pathD}`);
    console.log(`Diamond computations: ${counts.diamond}`);
    console.log(`Work multiplication factor: ${(counts.pathA + counts.pathB + counts.pathC + counts.pathD) / counts.diamond}x`);
  });

  it('should show version tracking behavior', () => {
    // Let's trace exactly when versions increment
    const source = signal(10);
    
    const filter = computed(() => {
      const val = source.value;
      console.log(`filter: input=${val}, output=${val > 50 ? val : 0}`);
      return val > 50 ? val : 0;
    });
    
    const consumer = computed(() => {
      const val = filter.value;
      console.log(`consumer: input=${val}`);
      return val * 2;
    });
    
    const getState = () => ({
      sourceVersion: (source as any)._version,
      filterVersion: (filter as any)._version,
      consumerVersion: (consumer as any)._version,
      filterFlags: (filter as any)._flags,
      consumerFlags: (consumer as any)._flags
    });
    
    console.log('\n=== Version tracking analysis ===');
    console.log('Initial read:');
    consumer.value;
    console.log('State:', getState());
    
    console.log('\nUpdate to 20 (still filtered):');
    source.value = 20;
    consumer.value;
    console.log('State:', getState());
    
    console.log('\nUpdate to 30 (still filtered):');
    source.value = 30;
    consumer.value;
    console.log('State:', getState());
    
    console.log('\nUpdate to 60 (passes filter):');
    source.value = 60;
    consumer.value;
    console.log('State:', getState());
  });
});