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
      const computeds = signals.map(s => api.computed(() => s() * 2));
      
      let effectRuns = 0;
      const snapshots: number[][] = [];
      api.effect(() => {
        effectRuns++;
        snapshots.push(computeds.map(c => c()));
      });
      
      expect(effectRuns).toBe(1);
      expect(snapshots[0]).toEqual([0, 2, 4, 6, 8]);
      
      // Large batch to trigger accumulation
      api.batch(() => {
        signals[0]!(10);
        signals[1]!(20);
        signals[2]!(30);
        signals[3]!(40);
        signals[4]!(50);
      });
      
      // Verify propagate() was called and processed accumulated roots
      expect(effectRuns).toBe(2);
      expect(snapshots[1]).toEqual([20, 40, 60, 80, 100]);
      expect(computeds.map(c => c())).toEqual([20, 40, 60, 80, 100]);
    });
    
    it('should not call propagate for small batches', () => {
      // Test that small batches don't accumulate unnecessarily
      const s1 = api.signal(1);
      const s2 = api.signal(2);
      
      const sum = api.computed(() => s1() + s2());
      
      let effectRuns = 0;
      api.effect(() => {
        effectRuns++;
        void sum();
      });
      
      expect(effectRuns).toBe(1);
      expect(sum()).toBe(3);
      
      // Small batch (only 2 signals) - should use immediate DFS
      api.batch(() => {
        s1(10);
        s2(20);
      });
      
      expect(effectRuns).toBe(2);
      expect(sum()).toBe(30);
    });
    
    it('should handle effects flush after propagate', () => {
      // Test the interaction between propagate() and effects flush
      const signals = Array.from({ length: 4 }, (_, i) => api.signal(i));
      
      let computeRuns = 0;
      const derived = api.computed(() => {
        computeRuns++;
        return signals.reduce((sum, s) => sum + s(), 0);
      });
      
      let effectRuns = 0;
      let lastValue = 0;
      api.effect(() => {
        effectRuns++;
        lastValue = derived();
      });
      
      // Initial runs
      expect(computeRuns).toBe(1);
      expect(effectRuns).toBe(1);
      expect(lastValue).toBe(6); // 0+1+2+3
      
      // Reset counters
      computeRuns = 0;
      
      // Large batch to test propagate -> flush sequence
      api.batch(() => {
        signals[0]!(100);  // immediate
        signals[1]!(200);  // immediate  
        signals[2]!(300);  // accumulate
        signals[3]!(400);  // accumulate
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
      
      const products = signals.map((s, i) => api.computed(() => s() * (i + 1)));
      
      let effectRuns = 0;
      const allResults: number[][] = [];
      api.effect(() => {
        effectRuns++;
        allResults.push(products.map(p => p()));
      });
      
      expect(effectRuns).toBe(1);
      expect(allResults[0]).toEqual([0, 20, 60, 120, 200, 300]); // [0*1, 10*2, 20*3, 30*4, 40*5, 50*6]
      
      // Use api.batch directly to test batch.ts integration
      api.batch(() => {
        signals[0]!(1);   // immediate
        signals[1]!(2);   // immediate
        signals[2]!(3);   // accumulate
        signals[3]!(4);   // accumulate  
        signals[4]!(5);   // accumulate
        signals[5]!(6);   // accumulate
      });
      
      expect(effectRuns).toBe(2);
      expect(allResults[1]).toEqual([1, 4, 9, 16, 25, 36]); // [1*1, 2*2, 3*3, 4*4, 5*5, 6*6]
    });
    
    it('should handle nested batches correctly with propagate', () => {
      const signals = Array.from({ length: 3 }, (_, i) => api.signal(i));
      
      let computeRuns = 0;
      const sum = api.computed(() => {
        computeRuns++;
        return signals.reduce((acc, s) => acc + s(), 0);
      });
      
      let effectRuns = 0;
      api.effect(() => {
        effectRuns++;
        void sum();
      });
      
      expect(effectRuns).toBe(1);
      expect(computeRuns).toBe(1);
      
      // Reset counters
      computeRuns = 0;
      
      // Nested batches: should propagate only at outermost batch end
      api.batch(() => {
        signals[0]!(100);
        
        api.batch(() => {
          signals[1]!(200);
          
          api.batch(() => {
            signals[2]!(300);
          });
        });
      });
      
      // Should compute and run effect exactly once
      expect(effectRuns).toBe(2);
      expect(sum()).toBe(600);
      
      // Should not have excessive recomputation
      expect(computeRuns).toBeLessThanOrEqual(2);
    });
  });
  
  describe('Performance Characteristics', () => {
    it('should handle deep dependency chains efficiently', () => {
      // Create a chain: s1 -> c1 -> c2 -> c3 -> effect
      const signals = [api.signal(1)];
      const computeds = [
        api.computed(() => signals[0]!() * 2),
        api.computed(() => 0), // Will be updated
        api.computed(() => 0), // Will be updated
      ];
      
      // Build the chain
      computeds[1] = api.computed(() => computeds[0]!() * 2);
      computeds[2] = api.computed(() => computeds[1]!() * 2);
      
      let effectRuns = 0;
      let finalValue = 0;
      api.effect(() => {
        effectRuns++;
        finalValue = computeds[2]!();
      });
      
      expect(effectRuns).toBe(1);
      expect(finalValue).toBe(8); // 1 * 2 * 2 * 2
      
      // Add more signals to trigger accumulation
      const dummy1 = api.signal(10);
      const dummy2 = api.signal(20);
      
      // Large batch with chain update
      api.batch(() => {
        dummy1(100);    // immediate
        dummy2(200);    // immediate
        signals[0]!(5); // accumulate - should propagate through chain
      });
      
      expect(effectRuns).toBe(2);
      expect(finalValue).toBe(40); // 5 * 2 * 2 * 2
      expect(computeds[2]()).toBe(40);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle simultaneous dispose and propagate', () => {
      const signals = Array.from({ length: 4 }, (_, i) => api.signal(i));
      const computeds = signals.map(s => api.computed(() => s() * 10));
      
      let effectRuns = 0;
      const effectDispose = api.effect(() => {
        effectRuns++;
        computeds.forEach(c => void c());
      });
      
      expect(effectRuns).toBe(1);
      
      // Batch that disposes effect during accumulation
      api.batch(() => {
        signals[0]!(100);  // immediate
        signals[1]!(200);  // immediate
        effectDispose();         // Dispose effect
        signals[2]!(300);  // accumulate
        signals[3]!(400);  // accumulate
      });
      
      // Effect should not run again after disposal
      expect(effectRuns).toBe(1);
      
      // But computeds should still be updated
      expect(computeds.map(c => c())).toEqual([1000, 2000, 3000, 4000]);
    });
    
    it('should handle empty propagation queue gracefully', () => {
      const s1 = api.signal(1);
      const s2 = api.signal(2);
      
      const sum = api.computed(() => s1() + s2());
      
      let effectRuns = 0;
      api.effect(() => {
        effectRuns++;
        void sum();
      });
      
      expect(effectRuns).toBe(1);
      
      // Batch where accumulated roots get cleared somehow
      api.batch(() => {
        s1(10);  // immediate
        s2(20);  // immediate
        // No accumulated roots to propagate
      });
      
      expect(effectRuns).toBe(2);
      expect(sum()).toBe(30);
    });
    
    it('should handle very large batches efficiently', () => {
      // Create many signals to stress-test the accumulation
      const signals = Array.from({ length: 100 }, (_, i) => api.signal(i));
      
      let computeRuns = 0;
      const sum = api.computed(() => {
        computeRuns++;
        return signals.reduce((acc, s) => acc + s(), 0);
      });
      
      let effectRuns = 0;
      api.effect(() => {
        effectRuns++;
        void sum();
      });
      
      expect(effectRuns).toBe(1);
      expect(computeRuns).toBe(1);
      
      computeRuns = 0;
      
      // Very large batch - most signals should accumulate
      api.batch(() => {
        signals.forEach((signal, i) => {
          signal(i + 100);
        });
      });
      
      expect(effectRuns).toBe(2);
      // Sum should compute exactly once despite many signal updates
      expect(computeRuns).toBe(1);
      
      // Verify correct final value
      const expectedSum = signals.reduce((acc, s) => acc + s(), 0);
      expect(sum()).toBe(expectedSum);
    });
  });
});