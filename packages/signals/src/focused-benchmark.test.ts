import { it, expect, describe } from 'vitest';
import { createContext } from './context';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createIterativeComputedFactory } from './iterative-computed';

describe('Focused Performance Benchmark: Recursive vs Iterative', () => {
  
  describe('Deep Chain Performance', () => {
    const depths = [10, 25, 50, 100, 200];
    
    for (const depth of depths) {
      it(`${depth}-level deep chain benchmark`, () => {
        const results: any = {};
        
        // Test recursive implementation
        {
          const ctx = createContext();
          const signal = createSignalFactory(ctx).method;
          const computed = createComputedFactory(ctx).method;
          
          const chain: any[] = [signal(0)];
          for (let i = 1; i <= depth; i++) {
            const prev = chain[i - 1];
            chain[i] = computed(() => prev.value + 1);
          }
          
          // Warm up
          chain[depth].value;
          
          // Measure initial computation
          const times = [];
          for (let run = 0; run < 10; run++) {
            chain[0].value = run;
            const start = performance.now();
            const result = chain[depth].value;
            times.push(performance.now() - start);
            expect(result).toBe(depth + run);
          }
          
          results.recursive = {
            avg: times.reduce((a, b) => a + b) / times.length,
            min: Math.min(...times),
            max: Math.max(...times)
          };
        }
        
        // Test iterative implementation
        {
          const ctx = createContext();
          const signal = createSignalFactory(ctx).method;
          const computed = createIterativeComputedFactory(ctx).method;
          
          const chain: any[] = [signal(0)];
          for (let i = 1; i <= depth; i++) {
            const prev = chain[i - 1];
            chain[i] = computed(() => prev.value + 1);
          }
          
          // Warm up
          chain[depth].value;
          
          // Measure
          const times = [];
          for (let run = 0; run < 10; run++) {
            chain[0].value = run;
            const start = performance.now();
            const result = chain[depth].value;
            times.push(performance.now() - start);
            expect(result).toBe(depth + run);
          }
          
          results.iterative = {
            avg: times.reduce((a, b) => a + b) / times.length,
            min: Math.min(...times),
            max: Math.max(...times)
          };
        }
        
        console.log(`\n${depth}-Level Chain Results:`);
        console.log(`Recursive:  avg=${results.recursive.avg.toFixed(3)}ms, min=${results.recursive.min.toFixed(3)}ms, max=${results.recursive.max.toFixed(3)}ms`);
        console.log(`Iterative:  avg=${results.iterative.avg.toFixed(3)}ms, min=${results.iterative.min.toFixed(3)}ms, max=${results.iterative.max.toFixed(3)}ms`);
        console.log(`Speed ratio: ${(results.recursive.avg / results.iterative.avg).toFixed(2)}x`);
      });
    }
  });

  describe('Memory and Stack Analysis', () => {
    it('should compare memory characteristics', () => {
      const depth = 100;
      console.log(`\n=== Memory Analysis for ${depth}-level chain ===`);
      
      // Measure recursive stack depth
      {
        const ctx = createContext();
        const signal = createSignalFactory(ctx).method;
        const computed = createComputedFactory(ctx).method;
        
        let maxDepth = 0;
        let currentDepth = 0;
        
        const chain: any[] = [signal(0)];
        for (let i = 1; i <= depth; i++) {
          const prev = chain[i - 1];
          const comp = computed(() => prev.value + 1);
          
          // Instrument _update
          const original = (comp as any)._update;
          (comp as any)._update = function() {
            currentDepth++;
            maxDepth = Math.max(maxDepth, currentDepth);
            try {
              return original.call(this);
            } finally {
              currentDepth--;
            }
          };
          
          chain[i] = comp;
        }
        
        chain[0].value = 1;
        chain[depth].value;
        
        console.log(`Recursive: Max recursion depth = ${maxDepth} frames`);
      }
      
      // Analyze iterative memory usage
      {
        const ctx = createContext();
        const signal = createSignalFactory(ctx).method;
        const computed = createIterativeComputedFactory(ctx).method;
        
        const chain: any[] = [signal(0)];
        for (let i = 1; i <= depth; i++) {
          const prev = chain[i - 1];
          chain[i] = computed(() => prev.value + 1);
        }
        
        // The iterative version uses internal arrays for tracking
        // We can't directly measure this without modifying the implementation
        console.log(`Iterative: Uses internal arrays for node tracking (no recursion)`);
      }
    });
  });

  describe('Conditional Dependencies', () => {
    it('should compare conditional branch handling', () => {
      console.log('\n=== Conditional Dependencies Benchmark ===');
      
      const implementations = [
        { name: 'Recursive', factory: createComputedFactory },
        { name: 'Iterative', factory: createIterativeComputedFactory }
      ];
      
      for (const impl of implementations) {
        const ctx = createContext();
        const signal = createSignalFactory(ctx).method;
        const computed = impl.factory(ctx).method;
        
        const condition = signal(true);
        const expensiveA = signal(1);
        const expensiveB = signal(2);
        
        let computeA = 0;
        let computeB = 0;
        
        const branchA = computed(() => {
          computeA++;
          return expensiveA.value * 1000;
        });
        
        const branchB = computed(() => {
          computeB++;
          return expensiveB.value * 1000;
        });
        
        const result = computed(() => condition.value ? branchA.value : branchB.value);
        
        // Initial
        result.value;
        
        // Measure unused branch update
        computeA = computeB = 0;
        const start1 = performance.now();
        expensiveB.value = 3; // Update unused branch
        result.value;
        const time1 = performance.now() - start1;
        
        // Measure branch switch
        const start2 = performance.now();
        condition.value = false;
        result.value;
        const time2 = performance.now() - start2;
        
        console.log(`${impl.name}:`);
        console.log(`  Unused branch: ${time1.toFixed(3)}ms (computeB=${computeB})`);
        console.log(`  Branch switch: ${time2.toFixed(3)}ms`);
      }
    });
  });

  describe('Extreme Deep Chains', () => {
    it('should test limits of each implementation', () => {
      console.log('\n=== Testing Implementation Limits ===');
      
      // Test recursive limit
      {
        const ctx = createContext();
        const signal = createSignalFactory(ctx).method;
        const computed = createComputedFactory(ctx).method;
        
        // Find the maximum safe depth for recursive
        let maxSafeDepth = 0;
        for (let testDepth = 100; testDepth <= 10000; testDepth += 100) {
          try {
            const chain: any[] = [signal(0)];
            for (let i = 1; i <= testDepth; i++) {
              const prev = chain[i - 1];
              chain[i] = computed(() => prev.value + 1);
            }
            chain[testDepth].value; // Try to compute
            maxSafeDepth = testDepth;
          } catch (e) {
            console.log(`Recursive: Maximum safe depth ≈ ${maxSafeDepth} (failed at ${testDepth})`);
            break;
          }
        }
      }
      
      // Test iterative limit
      {
        const ctx = createContext();
        const signal = createSignalFactory(ctx).method;
        const computed = createIterativeComputedFactory(ctx).method;
        
        // Test much deeper chains
        const testDepth = 5000;
        try {
          const chain: any[] = [signal(0)];
          for (let i = 1; i <= testDepth; i++) {
            const prev = chain[i - 1];
            chain[i] = computed(() => prev.value + 1);
          }
          
          const start = performance.now();
          const result = chain[testDepth].value;
          const time = performance.now() - start;
          
          expect(result).toBe(testDepth);
          console.log(`Iterative: Successfully handled ${testDepth}-deep chain in ${time.toFixed(3)}ms`);
        } catch (e) {
          console.log(`Iterative: Failed at depth ${testDepth}: ${e}`);
        }
      }
    });
  });
});