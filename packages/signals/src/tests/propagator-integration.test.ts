import { describe, it, expect, beforeEach } from 'vitest';
import { createTestInstance } from '../test-setup';

describe('Propagator Integration with Signal and Batch', () => {
  let api: ReturnType<typeof createTestInstance>;
  
  beforeEach(() => {
    api = createTestInstance();
  });

  describe('Signal.ts Integration', () => {
    it('should call propagate at end of batch for accumulated roots', () => {
      // This tests the integration point at signal.ts line 163
      const signals = Array.from({ length: 5 }, (_, i) => api.signal(i));
      const computeds = signals.map(s => api.computed(() => s.value * 2));
      
      let effectRuns = 0;
      const snapshots: number[][] = [];
      api.effect(() => {
        effectRuns++;
        snapshots.push(computeds.map(c => c.value));
      });
      
      expect(effectRuns).toBe(1);
      expect(snapshots[0]).toEqual([0, 2, 4, 6, 8]);
      
      // Large batch to trigger accumulation
      api.batch(() => {
        signals[0]!.value = 10;  // immediate dfs
        signals[1]!.value = 20;  // immediate dfs
        signals[2]!.value = 30;  // accumulate
        signals[3]!.value = 40;  // accumulate
        signals[4]!.value = 50;  // accumulate
      });
      
      // Verify propagate() was called and processed accumulated roots
      expect(effectRuns).toBe(2);
      expect(snapshots[1]).toEqual([20, 40, 60, 80, 100]);
      expect(computeds.map(c => c.value)).toEqual([20, 40, 60, 80, 100]);
    });
    
    it('should not call propagate for small batches', () => {
      // Test that small batches don't accumulate unnecessarily
      const s1 = api.signal(1);
      const s2 = api.signal(2);
      
      const sum = api.computed(() => s1.value + s2.value);
      
      let effectRuns = 0;
      api.effect(() => {
        effectRuns++;
        void sum.value;
      });
      
      expect(effectRuns).toBe(1);
      expect(sum.value).toBe(3);
      
      // Small batch (only 2 signals) - should use immediate DFS
      api.batch(() => {
        s1.value = 10;  // immediate dfs
        s2.value = 20;  // immediate dfs
      });
      
      expect(effectRuns).toBe(2);
      expect(sum.value).toBe(30);
    });
    
    it('should handle effects flush after propagate', () => {
      // Test the interaction between propagate() and effects flush
      const signals = Array.from({ length: 4 }, (_, i) => api.signal(i));
      
      let computeRuns = 0;
      const derived = api.computed(() => {
        computeRuns++;
        return signals.reduce((sum, s) => sum + s.value, 0);
      });
      
      let effectRuns = 0;
      let lastValue = 0;
      api.effect(() => {
        effectRuns++;
        lastValue = derived.value;
      });
      
      // Initial runs
      expect(computeRuns).toBe(1);
      expect(effectRuns).toBe(1);
      expect(lastValue).toBe(6); // 0+1+2+3
      
      // Reset counters
      computeRuns = 0;
      
      // Large batch to test propagate -> flush sequence
      api.batch(() => {
        signals[0]!.value = 100;  // immediate
        signals[1]!.value = 200;  // immediate  
        signals[2]!.value = 300;  // accumulate
        signals[3]!.value = 400;  // accumulate
      });
      
      // Effect should run exactly once after propagate finishes
      expect(effectRuns).toBe(2);
      expect(lastValue).toBe(1000); // 100+200+300+400
      
      // Computed should not have redundant recalculations
      expect(computeRuns).toBeLessThanOrEqual(2); // Allow some recomputation during batch
    });
  });
  
  describe('Batch.ts Integration', () => {
    it('should call propagate at batch commit', () => {
      // This tests the integration point at batch.ts line 112
      const signals = Array.from({ length: 6 }, (_, i) => api.signal(i * 10));
      
      const products = signals.map((s, i) => api.computed(() => s.value * (i + 1)));
      
      let effectRuns = 0;
      const allResults: number[][] = [];
      api.effect(() => {
        effectRuns++;
        allResults.push(products.map(p => p.value));
      });
      
      expect(effectRuns).toBe(1);
      expect(allResults[0]).toEqual([0, 20, 60, 120, 200, 300]); // [0*1, 10*2, 20*3, 30*4, 40*5, 50*6]
      
      // Use api.batch directly to test batch.ts integration
      api.batch(() => {
        signals[0]!.value = 1;   // immediate
        signals[1]!.value = 2;   // immediate
        signals[2]!.value = 3;   // accumulate
        signals[3]!.value = 4;   // accumulate  
        signals[4]!.value = 5;   // accumulate
        signals[5]!.value = 6;   // accumulate
      });
      
      expect(effectRuns).toBe(2);
      expect(allResults[1]).toEqual([1, 4, 9, 16, 25, 36]); // [1*1, 2*2, 3*3, 4*4, 5*5, 6*6]
    });
    
    it('should handle nested batches correctly with propagate', () => {
      const signals = Array.from({ length: 3 }, (_, i) => api.signal(i));
      
      let computeRuns = 0;
      const sum = api.computed(() => {
        computeRuns++;
        return signals.reduce((acc, s) => acc + s.value, 0);
      });
      
      let effectRuns = 0;
      api.effect(() => {
        effectRuns++;
        void sum.value;
      });
      
      expect(effectRuns).toBe(1);
      expect(computeRuns).toBe(1);
      
      // Reset counters
      computeRuns = 0;
      
      // Nested batches: should propagate only at outermost batch end
      api.batch(() => {
        signals[0]!.value = 100;
        
        api.batch(() => {
          signals[1]!.value = 200;
          
          api.batch(() => {
            signals[2]!.value = 300;
          });
        });
      });
      
      // Should compute and run effect exactly once
      expect(effectRuns).toBe(2);
      expect(sum.value).toBe(600);
      
      // Should not have excessive recomputation
      expect(computeRuns).toBeLessThanOrEqual(2);
    });
    
    it('should handle batch errors without breaking propagation', () => {
      const signals = Array.from({ length: 4 }, (_, i) => api.signal(i));
      
      const errorComputed = api.computed(() => {
        if (signals[1]!.value === 999) {
          throw new Error('Test batch error');
        }
        return signals.reduce((acc, s) => acc + s.value, 0);
      });
      
      let effectRuns = 0;
      api.effect(() => {
        effectRuns++;
        try {
          void errorComputed.value;
        } catch {
          // Ignore errors in effect
        }
      });
      
      expect(effectRuns).toBe(1);
      
      // Batch that will cause error during propagation
      expect(() => {
        api.batch(() => {
          signals[0]!.value = 100;  // immediate
          signals[1]!.value = 999;  // immediate - will cause error
          signals[2]!.value = 300;  // should accumulate
          signals[3]!.value = 400;  // should accumulate
        });
      }).toThrow('Test batch error');
      
      // Verify system is still functional after error
      api.batch(() => {
        signals[0]!.value = 10;
        signals[1]!.value = 20;  // Safe value
        signals[2]!.value = 30;
        signals[3]!.value = 40;
      });
      
      expect(errorComputed.value).toBe(100); // 10+20+30+40
    });
  });
  
  describe('Performance Characteristics', () => {
    it('should correctly propagate accumulated updates to dependencies', () => {
      // This test verifies that our simplified propagator correctly propagates
      // all accumulated signal updates to their dependents at batch end.
      
      const root = api.signal(0);
      const leaves = Array.from({ length: 5 }, (_, i) => 
        api.computed(() => root.value + i)
      );
      
      let effectRuns = 0;
      api.effect(() => {
        effectRuns++;
        leaves.forEach(leaf => void leaf.value);
      });
      
      expect(effectRuns).toBe(1);
      expect(leaves.map(l => l.value)).toEqual([0, 1, 2, 3, 4]);
      
      const dummy1 = api.signal(1);
      const dummy2 = api.signal(2);
      
      api.batch(() => {
        dummy1.value = 10;  // immediate DFS
        dummy2.value = 20;  // immediate DFS
        root.value = 100;   // accumulate - BUG: doesn't propagate to all leaves
      });
      
      expect(effectRuns).toBe(2);
      expect(root.value).toBe(100);
      
      // With our simplified propagator, all accumulated updates now properly
      // propagate to their dependents at batch end
      const actualValues = leaves.map(l => l.value);
      
      // All leaves should be correctly updated
      expect(actualValues).toEqual([100, 101, 102, 103, 104]);
    });
    
    it('should handle deep dependency chains efficiently', () => {
      // Create a chain: s1 -> c1 -> c2 -> c3 -> effect
      const signals = [api.signal(1)];
      const computeds = [
        api.computed(() => signals[0]!.value * 2),
        api.computed(() => 0), // Will be updated
        api.computed(() => 0), // Will be updated
      ];
      
      // Build the chain
      computeds[1] = api.computed(() => computeds[0]!.value * 2);
      computeds[2] = api.computed(() => computeds[1]!.value * 2);
      
      let effectRuns = 0;
      let finalValue = 0;
      api.effect(() => {
        effectRuns++;
        finalValue = computeds[2]!.value;
      });
      
      expect(effectRuns).toBe(1);
      expect(finalValue).toBe(8); // 1 * 2 * 2 * 2
      
      // Add more signals to trigger accumulation
      const dummy1 = api.signal(10);
      const dummy2 = api.signal(20);
      
      // Large batch with chain update
      api.batch(() => {
        dummy1.value = 100;    // immediate
        dummy2.value = 200;    // immediate
        signals[0]!.value = 5; // accumulate - should propagate through chain
      });
      
      expect(effectRuns).toBe(2);
      expect(finalValue).toBe(40); // 5 * 2 * 2 * 2
      expect(computeds[2].value).toBe(40);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle simultaneous dispose and propagate', () => {
      const signals = Array.from({ length: 4 }, (_, i) => api.signal(i));
      const computeds = signals.map(s => api.computed(() => s.value * 10));
      
      let effectRuns = 0;
      const effectDispose = api.effect(() => {
        effectRuns++;
        computeds.forEach(c => void c.value);
      });
      
      expect(effectRuns).toBe(1);
      
      // Batch that disposes effect during accumulation
      api.batch(() => {
        signals[0]!.value = 100;  // immediate
        signals[1]!.value = 200;  // immediate
        effectDispose();         // Dispose effect
        signals[2]!.value = 300;  // accumulate
        signals[3]!.value = 400;  // accumulate
      });
      
      // Effect should not run again after disposal
      expect(effectRuns).toBe(1);
      
      // But computeds should still be updated
      expect(computeds.map(c => c.value)).toEqual([1000, 2000, 3000, 4000]);
    });
    
    it('should handle empty propagation queue gracefully', () => {
      const s1 = api.signal(1);
      const s2 = api.signal(2);
      
      const sum = api.computed(() => s1.value + s2.value);
      
      let effectRuns = 0;
      api.effect(() => {
        effectRuns++;
        void sum.value;
      });
      
      expect(effectRuns).toBe(1);
      
      // Batch where accumulated roots get cleared somehow
      api.batch(() => {
        s1.value = 10;  // immediate
        s2.value = 20;  // immediate
        // No accumulated roots to propagate
      });
      
      expect(effectRuns).toBe(2);
      expect(sum.value).toBe(30);
    });
    
    it('should handle very large batches efficiently', () => {
      // Create many signals to stress-test the accumulation
      const signals = Array.from({ length: 100 }, (_, i) => api.signal(i));
      
      let computeRuns = 0;
      const sum = api.computed(() => {
        computeRuns++;
        return signals.reduce((acc, s) => acc + s.value, 0);
      });
      
      let effectRuns = 0;
      api.effect(() => {
        effectRuns++;
        void sum.value;
      });
      
      expect(effectRuns).toBe(1);
      expect(computeRuns).toBe(1);
      
      computeRuns = 0;
      
      // Very large batch - most signals should accumulate
      api.batch(() => {
        signals.forEach((signal, i) => {
          signal.value = i + 100;
        });
      });
      
      expect(effectRuns).toBe(2);
      // Sum should compute exactly once despite many signal updates
      expect(computeRuns).toBe(1);
      
      // Verify correct final value
      const expectedSum = signals.reduce((acc, s) => acc + s.value, 0);
      expect(sum.value).toBe(expectedSum);
    });
  });
});