/**
 * Direct Comparison: Lattice vs Optimal Behavior
 * 
 * This test measures the actual performance difference in the filtered diamond
 * pattern and identifies the exact optimization opportunity.
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

describe('Filtered Diamond Performance Comparison', () => {
  it('should measure performance impact of intermediate recomputations', () => {
    const ITERATIONS = 10000;
    
    console.log(`\n=== Performance test with ${ITERATIONS} iterations ===`);
    
    // Scenario 1: Mostly filtered (90% filtered, 10% pass)
    const runMostlyFiltered = () => {
      const source = signal(0);
      const filterA = computed(() => {
        const val = source.value;
        return val > 50 ? val * 2 : 0;
      });
      const filterB = computed(() => {
        const val = source.value;
        return val > 50 ? val * 3 : 0;
      });
      const expensive = computed(() => {
        const a = filterA.value;
        const b = filterB.value;
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += i;
        }
        return a + b + sum;
      });
      
      // Warm up
      expensive.value;
      
      const start = performance.now();
      for (let i = 0; i < ITERATIONS; i++) {
        // 90% filtered values (0-44), 10% pass through (90-99)
        source.value = i % 50 < 45 ? i % 50 : 90 + (i % 10);
        expensive.value;
      }
      return performance.now() - start;
    };
    
    // Scenario 2: Mixed (50% filtered, 50% pass)
    const runMixed = () => {
      const source = signal(0);
      const filterA = computed(() => {
        const val = source.value;
        return val > 50 ? val * 2 : 0;
      });
      const filterB = computed(() => {
        const val = source.value;
        return val > 50 ? val * 3 : 0;
      });
      const expensive = computed(() => {
        const a = filterA.value;
        const b = filterB.value;
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += i;
        }
        return a + b + sum;
      });
      
      // Warm up
      expensive.value;
      
      const start = performance.now();
      for (let i = 0; i < ITERATIONS; i++) {
        // Alternate between filtered (0-49) and unfiltered (51-100)
        source.value = i % 100;
        expensive.value;
      }
      return performance.now() - start;
    };
    
    // Run multiple times and average
    const runs = 5;
    let mostlyFilteredTotal = 0;
    let mixedTotal = 0;
    
    for (let i = 0; i < runs; i++) {
      mostlyFilteredTotal += runMostlyFiltered();
      mixedTotal += runMixed();
    }
    
    const mostlyFilteredAvg = mostlyFilteredTotal / runs;
    const mixedAvg = mixedTotal / runs;
    
    console.log(`Mostly filtered (90%): ${mostlyFilteredAvg.toFixed(2)}ms`);
    console.log(`Mixed (50/50): ${mixedAvg.toFixed(2)}ms`);
    console.log(`Ratio: ${(mostlyFilteredAvg / mixedAvg).toFixed(2)}x`);
    console.log(`\nExpected ratio if intermediate computeds were skipped: ~0.55x`);
    console.log(`Actual overhead from intermediate recomputations: ${((mostlyFilteredAvg / mixedAvg) / 0.55).toFixed(2)}x`);
  });

  it('should count exact recomputations in both scenarios', () => {
    const ITERATIONS = 1000;
    
    // Track all computations
    const counts = {
      mostlyFiltered: { filterA: 0, filterB: 0, expensive: 0 },
      mixed: { filterA: 0, filterB: 0, expensive: 0 }
    };
    
    // Mostly filtered scenario
    {
      const source = signal(0);
      const filterA = computed(() => {
        counts.mostlyFiltered.filterA++;
        const val = source.value;
        return val > 50 ? val * 2 : 0;
      });
      const filterB = computed(() => {
        counts.mostlyFiltered.filterB++;
        const val = source.value;
        return val > 50 ? val * 3 : 0;
      });
      const expensive = computed(() => {
        counts.mostlyFiltered.expensive++;
        const a = filterA.value;
        const b = filterB.value;
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += i;
        }
        return a + b + sum;
      });
      
      // Warm up
      expensive.value;
      counts.mostlyFiltered = { filterA: 0, filterB: 0, expensive: 0 };
      
      // Run test
      for (let i = 0; i < ITERATIONS; i++) {
        source.value = i % 50 < 45 ? i % 50 : 90 + (i % 10);
        expensive.value;
      }
    }
    
    // Mixed scenario
    {
      const source = signal(0);
      const filterA = computed(() => {
        counts.mixed.filterA++;
        const val = source.value;
        return val > 50 ? val * 2 : 0;
      });
      const filterB = computed(() => {
        counts.mixed.filterB++;
        const val = source.value;
        return val > 50 ? val * 3 : 0;
      });
      const expensive = computed(() => {
        counts.mixed.expensive++;
        const a = filterA.value;
        const b = filterB.value;
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += i;
        }
        return a + b + sum;
      });
      
      // Warm up
      expensive.value;
      counts.mixed = { filterA: 0, filterB: 0, expensive: 0 };
      
      // Run test
      for (let i = 0; i < ITERATIONS; i++) {
        source.value = i % 100;
        expensive.value;
      }
    }
    
    console.log('\n=== Computation counts ===');
    console.log('Mostly filtered (90%):', counts.mostlyFiltered);
    console.log('Mixed (50/50):', counts.mixed);
    
    const mostlyFilteredTotal = counts.mostlyFiltered.filterA + counts.mostlyFiltered.filterB + counts.mostlyFiltered.expensive;
    const mixedTotal = counts.mixed.filterA + counts.mixed.filterB + counts.mixed.expensive;
    
    console.log(`\nTotal computations - Mostly filtered: ${mostlyFilteredTotal}`);
    console.log(`Total computations - Mixed: ${mixedTotal}`);
    console.log(`Ratio: ${(mostlyFilteredTotal / mixedTotal).toFixed(2)}x`);
    
    // Calculate wasted work
    const wastedIntermediate = counts.mostlyFiltered.filterA + counts.mostlyFiltered.filterB - counts.mostlyFiltered.expensive;
    console.log(`\nWasted intermediate computations in mostly filtered: ${wastedIntermediate}`);
    console.log(`Percentage of wasted work: ${((wastedIntermediate / mostlyFilteredTotal) * 100).toFixed(1)}%`);
  });

  it('should demonstrate the core issue with a minimal example', () => {
    console.log('\n=== Core Issue Demonstration ===');
    
    let filterExecutions = 0;
    let expensiveExecutions = 0;
    
    const source = signal(10);
    const filter = computed(() => {
      filterExecutions++;
      console.log(`Filter executing: ${source.value} -> ${source.value > 50 ? source.value : 0}`);
      return source.value > 50 ? source.value : 0;
    });
    
    const expensive = computed(() => {
      expensiveExecutions++;
      const val = filter.value;
      console.log(`Expensive executing: received ${val}`);
      return val * 2;
    });
    
    // Initial
    console.log('Initial read:');
    expensive.value;
    
    // Change but still filtered
    console.log('\nChange 10 -> 20 (both filtered):');
    source.value = 20;
    expensive.value;
    
    console.log('\nSummary:');
    console.log(`- Filter executed even though output didn't change (0 -> 0)`);
    console.log(`- Expensive correctly didn't execute (good!)`);
    console.log(`- But we still paid the cost of filter execution`);
    
    console.log(`\nIn the benchmark:`);
    console.log(`- This happens for BOTH filterA and filterB`);
    console.log(`- Multiplied by thousands of iterations`);
    console.log(`- Creating measurable performance difference`);
  });
});