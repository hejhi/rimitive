import { it, expect, describe } from 'vitest';
import { createSignalAPI } from '../index';
import { createSignalFactory } from '../signal';
import { createComputedFactory } from '../computed';
import { createEffectFactory } from '../effect';
import { createBatchFactory } from '../batch';
import { iterativeUpdate } from './iterative-update';

describe('Iterative vs Recursive performance comparison', () => {
  const api = createSignalAPI({
    signal: createSignalFactory,
    computed: createComputedFactory,
    effect: createEffectFactory,
    batch: createBatchFactory,
  });
  
  const { signal, computed } = api;
  const ctx = api._ctx;

  it('should show performance difference for deep chains', () => {
    const depths = [10, 20, 30, 50];
    
    for (const depth of depths) {
      const chain: any[] = [];
      
      // Create deep chain
      chain[0] = signal(0);
      for (let i = 1; i <= depth; i++) {
        const prev = chain[i - 1];
        chain[i] = computed(() => prev.value + 1);
      }
      
      // Warm up both approaches
      chain[depth].value;
      (chain[0] as any).value = 1;
      iterativeUpdate(chain[depth] as any, ctx);
      
      // Measure recursive approach
      const iterations = 1000;
      (chain[0] as any).value = 2;
      
      const recursiveStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        (chain[0] as any)._version++;
        chain[depth].value;
      }
      const recursiveTime = performance.now() - recursiveStart;
      
      // Measure iterative approach
      (chain[0] as any).value = 3;
      
      const iterativeStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        (chain[0] as any)._version++;
        iterativeUpdate(chain[depth] as any, ctx);
      }
      const iterativeTime = performance.now() - iterativeStart;
      
      console.log(`Depth ${depth}:`);
      console.log(`  Recursive: ${recursiveTime.toFixed(2)}ms`);
      console.log(`  Iterative: ${iterativeTime.toFixed(2)}ms`);
      console.log(`  Speedup: ${(recursiveTime / iterativeTime).toFixed(2)}x`);
      
      // Just verify both approaches work correctly
      expect((chain[depth] as any)._value).toBe(depth + 3);
    }
  });

  it('should handle conditional dependencies more efficiently', () => {
    // Create a conditional dependency scenario
    const condition = signal(true);
    const depth = 30;
    
    // Create two deep chains
    const chainA: any[] = [];
    const chainB: any[] = [];
    
    chainA[0] = signal(0);
    chainB[0] = signal(0);
    
    for (let i = 1; i <= depth; i++) {
      const prevA = chainA[i - 1];
      const prevB = chainB[i - 1];
      chainA[i] = computed(() => prevA.value + 1);
      chainB[i] = computed(() => prevB.value + 1);
    }
    
    // Create conditional computed
    const result = computed(() => {
      if (condition.value) {
        return chainA[depth].value;
      } else {
        return chainB[depth].value;
      }
    });
    
    // Warm up
    result.value;
    
    // Test updating inactive branch
    const iterations = 100;
    
    // Recursive approach
    const recursiveStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      (chainB[0] as any).value++;
      result.value; // Should be fast since chainB is inactive
    }
    const recursiveTime = performance.now() - recursiveStart;
    
    // Reset
    (chainB[0] as any).value = 0;
    
    // Iterative approach
    const iterativeStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      (chainB[0] as any).value++;
      iterativeUpdate(result as any, ctx);
    }
    const iterativeTime = performance.now() - iterativeStart;
    
    console.log(`Conditional dependency (inactive branch update):`);
    console.log(`  Recursive: ${recursiveTime.toFixed(2)}ms`);
    console.log(`  Iterative: ${iterativeTime.toFixed(2)}ms`);
    console.log(`  Speedup: ${(recursiveTime / iterativeTime).toFixed(2)}x`);
    
    // Both should have correct value
    expect(result.value).toBe(depth);
  });
});