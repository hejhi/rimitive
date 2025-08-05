import { describe, it, expect } from 'vitest';
import { 
  createSignalAPI,
  createSignalFactory,
  createComputedFactory,
  createEffectFactory
} from '../index';

describe('Diamond Pattern Optimization Opportunity', () => {
  it('demonstrates unnecessary recomputation in filtered diamond pattern', () => {
    const { signal, computed } = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory
    });

    let filterAComputations = 0;
    let filterBComputations = 0;
    let expensiveComputations = 0;

    // Create source signal
    const source = signal(10);

    // Create filtered computeds that count executions
    const filterA = computed(() => {
      filterAComputations++;
      const value = source.value;
      return value < 50 ? null : value;
    });

    const filterB = computed(() => {
      filterBComputations++;
      const value = source.value;
      return value < 50 ? null : value;
    });

    // Create expensive computation
    const expensive = computed(() => {
      expensiveComputations++;
      const a = filterA.value;
      const b = filterB.value;
      return (a === null || b === null) ? 0 : a + b;
    });

    // Initial read
    expect(expensive.value).toBe(0);
    expect(filterAComputations).toBe(1);
    expect(filterBComputations).toBe(1);
    expect(expensiveComputations).toBe(1);

    // Change source but keep it filtered
    source.value = 20;
    expect(expensive.value).toBe(0);
    
    // THE PROBLEM: filterA and filterB recomputed even though their output didn't change
    expect(filterAComputations).toBe(2); // Should ideally be 1
    expect(filterBComputations).toBe(2); // Should ideally be 1
    expect(expensiveComputations).toBe(1); // Good - expensive didn't recompute

    console.log('\n=== OPTIMIZATION OPPORTUNITY ===');
    console.log('When source changes from 10 -> 20 (both filtered):');
    console.log(`- filterA recomputed: ${filterAComputations - 1} times (unnecessary)`);
    console.log(`- filterB recomputed: ${filterBComputations - 1} times (unnecessary)`);
    console.log(`- expensive recomputed: 0 times (correct)`);
    console.log('\nThe filters recompute even though their output remains null.');
    console.log('With early termination, we could skip these recomputations.');
  });

  it('quantifies the performance impact', () => {
    const { signal, computed } = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory
    });

    const ITERATIONS = 1000;
    let totalRecomputations = 0;

    const source = signal(10);

    // Simulate expensive filter operations
    const createExpensiveFilter = () => computed(() => {
      totalRecomputations++;
      const value = source.value;
      
      // Simulate expensive computation
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += Math.sqrt(i) * Math.log(i + 1);
      }
      
      return value < 50 ? null : value + sum;
    });

    // Create multiple filter branches
    const filters = Array.from({ length: 10 }, () => createExpensiveFilter());
    
    // Diamond head that depends on all filters
    const aggregate = computed(() => {
      const results = filters.map(f => f.value);
      return results.every(r => r === null) ? 0 : results.reduce((a, b) => (a ?? 0) + (b ?? 0), 0);
    });

    // Initial read
    aggregate.value;
    const initialRecomputations = totalRecomputations;

    // Measure recomputations for filtered changes
    const startTime = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      source.value = 10 + (i % 40); // All values < 50, so always filtered
      aggregate.value;
    }
    const filteredTime = performance.now() - startTime;
    const filteredRecomputations = totalRecomputations - initialRecomputations;

    console.log('\n=== PERFORMANCE IMPACT ===');
    console.log(`${ITERATIONS} updates where all values are filtered:`);
    console.log(`- Total filter recomputations: ${filteredRecomputations}`);
    console.log(`- Time spent: ${filteredTime.toFixed(2)}ms`);
    console.log(`- Recomputations per update: ${filteredRecomputations / ITERATIONS}`);
    console.log('\nWith early termination, these recomputations could be avoided.');
  });
});