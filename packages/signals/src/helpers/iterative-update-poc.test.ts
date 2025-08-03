import { it, expect, describe } from 'vitest';
import { createSignalAPI } from '../index';
import { createSignalFactory } from '../signal';
import { createComputedFactory } from '../computed';
import { createEffectFactory } from '../effect';
import { createBatchFactory } from '../batch';
import { iterativeUpdate } from './iterative-update';

describe('Iterative update proof of concept', () => {
  const api = createSignalAPI({
    signal: createSignalFactory,
    computed: createComputedFactory,
    effect: createEffectFactory,
    batch: createBatchFactory,
  });
  
  const { signal, computed } = api;
  const ctx = api._ctx;

  it('should update a simple chain without recursion', () => {
    
    const base = signal(0);
    const level1 = computed(() => base.value + 1);
    const level2 = computed(() => level1.value + 1);
    
    // Initial values
    expect(level2.value).toBe(2);
    
    // Update base
    base.value = 10;
    
    // Use iterative update instead of recursive
    iterativeUpdate(level2 as any, ctx);
    
    // Should have updated correctly
    expect((level2 as any)._value).toBe(12);
  });

  it('should handle deep chains without stack overflow', () => {
    const depth = 100;
    const chain: any[] = [];
    
    chain[0] = signal(0);
    for (let i = 1; i <= depth; i++) {
      const prev = chain[i - 1];
      chain[i] = computed(() => prev.value + 1);
    }
    
    // Update base
    (chain[0] as any).value = 10;
    
    // Use iterative update - should not cause stack overflow
    iterativeUpdate(chain[depth] as any, ctx);
    
    expect((chain[depth] as any)._value).toBe(110);
  });

  it('should detect circular dependencies', () => {
    
    let a: any;
    let b: any;
    
    a = computed(() => b.value);
    b = computed(() => a.value);
    
    // Mark both as needing update
    (a as any)._flags |= 1; // NOTIFIED
    (b as any)._flags |= 1; // NOTIFIED
    
    expect(() => iterativeUpdate(a as any, ctx)).toThrow('Cycle detected');
  });

  it('should handle conditional dependencies', () => {
    
    const condition = signal(true);
    const branchA = signal(1);
    const branchB = signal(2);
    
    const result = computed(() => {
      if (condition.value) {
        return branchA.value;
      } else {
        return branchB.value;
      }
    });
    
    // Initial read
    expect(result.value).toBe(1);
    
    // Update inactive branch
    branchB.value = 10;
    
    // Use iterative update
    iterativeUpdate(result as any, ctx);
    
    // Should still be 1 (branch A)
    expect((result as any)._value).toBe(1);
    
    // Switch condition
    condition.value = false;
    iterativeUpdate(result as any, ctx);
    
    // Should now be 10 (branch B)
    expect((result as any)._value).toBe(10);
  });
});