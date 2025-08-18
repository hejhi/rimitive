import { describe, it, expect, beforeEach } from 'vitest';
import { createTestInstance } from '../test-setup';

describe('Propagator Large Batch Behavior', () => {
  let api: ReturnType<typeof createTestInstance>;
  
  beforeEach(() => {
    api = createTestInstance();
  });

  it('should handle large batches with 3+ signal updates', () => {
    const s1 = api.signal(1);
    const s2 = api.signal(2);
    const s3 = api.signal(3);
    
    const sum = api.computed(() => s1.value + s2.value + s3.value);
    
    let effectCount = 0;
    let lastSum = 0;
    api.effect(() => {
      effectCount++;
      lastSum = sum.value;
    });
    
    // Initial effect run
    expect(effectCount).toBe(1);
    expect(lastSum).toBe(6);
    
    // Large batch with 3 signals (should trigger propagator accumulation)
    api.batch(() => {
      s1.value = 10;
      s2.value = 20;
      s3.value = 30;
    });
    
    // This might fail if propagate() is never called!
    expect(effectCount).toBe(2);
    expect(lastSum).toBe(60);
    expect(sum.value).toBe(60);
  });
  
  it('demonstrates that third+ signals in batch may not propagate correctly', () => {
    // Create 5 signals that each connect to their own computed
    const signals = Array.from({ length: 5 }, (_, i) => api.signal(i));
    const computeds = signals.map((s, i) => 
      api.computed(() => {
        console.log(`Computing computed[${i}]`);
        return s.value * 2;
      })
    );
    
    let effectRuns = 0;
    const values: number[] = [];
    api.effect(() => {
      effectRuns++;
      values.push(...computeds.map(c => c.value));
    });
    
    // Initial run
    expect(effectRuns).toBe(1);
    
    // Update all 5 signals in a batch
    // First 2 should trigger immediate dfs()
    // Signals 3-5 should be added to roots but never processed?
    api.batch(() => {
      signals[0]!.value = 10;  // immediate dfs
      signals[1]!.value = 20;  // immediate dfs
      signals[2]!.value = 30;  // just add() - never processed?
      signals[3]!.value = 40;  // just add() - never processed?
      signals[4]!.value = 50;  // just add() - never processed?
    });
    
    // Check if all computeds updated
    expect(computeds[0]!.value).toBe(20);
    expect(computeds[1]!.value).toBe(40);
    expect(computeds[2]!.value).toBe(60);  // This might be wrong!
    expect(computeds[3]!.value).toBe(80);  // This might be wrong!
    expect(computeds[4]!.value).toBe(100); // This might be wrong!
    
    expect(effectRuns).toBe(2);
  });

  it('verifies propagator optimization is called for large batches', () => {
    // Create more signals to trigger aggregation (need rootsSize >= 2)
    const s1 = api.signal(1);
    const s2 = api.signal(2);
    const s3 = api.signal(3);
    const s4 = api.signal(4);
    const s5 = api.signal(5);
    
    const sum = api.computed(() => s1.value + s2.value + s3.value + s4.value + s5.value);
    
    let effectRuns = 0;
    api.effect(() => {
      effectRuns++;
      void sum.value; // Read to establish dependency
    });
    
    // Initial effect run
    expect(effectRuns).toBe(1);
    expect(sum.value).toBe(15);
    
    // Large batch: Should trigger accumulation after 2nd signal
    api.batch(() => {
      s1.value = 10; // immediate dfs (rootsSize=0)
      s2.value = 20; // immediate dfs (rootsSize=1) 
      s3.value = 30; // add() to roots (rootsSize=2)
      s4.value = 40; // add() to roots
      s5.value = 50; // add() to roots
    });
    
    // Verify all values are correct (proves propagate worked)
    expect(effectRuns).toBe(2);
    expect(sum.value).toBe(150); // 10+20+30+40+50
  });
});
