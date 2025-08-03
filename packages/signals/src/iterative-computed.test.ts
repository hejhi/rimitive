import { it, expect, describe } from 'vitest';
import { createSignalAPI } from './index';
import { createSignalFactory } from './signal';
import { createIterativeComputedFactory } from './iterative-computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';

describe('Iterative Computed Implementation', () => {
  const { signal, computed, effect } = createSignalAPI({
    signal: createSignalFactory,
    computed: createIterativeComputedFactory, // Use iterative version
    effect: createEffectFactory,
    batch: createBatchFactory,
  });

  it('should handle basic computed values', () => {
    const a = signal(1);
    const b = signal(2);
    const sum = computed(() => a.value + b.value);
    
    expect(sum.value).toBe(3);
    
    a.value = 5;
    expect(sum.value).toBe(7);
    
    b.value = 10;
    expect(sum.value).toBe(15);
  });

  it('should handle deep dependency chains without stack overflow', () => {
    const depth = 100;
    const signals: any[] = [signal(0)];
    
    // Create a deep chain of computeds
    for (let i = 1; i <= depth; i++) {
      const prev = signals[i - 1];
      signals[i] = computed(() => prev.value + 1);
    }
    
    // Should compute without stack overflow
    expect(signals[depth].value).toBe(100);
    
    // Update base and verify propagation
    signals[0].value = 10;
    expect(signals[depth].value).toBe(110);
  });

  it('should handle conditional dependencies', () => {
    const condition = signal(true);
    const a = signal(1);
    const b = signal(2);
    
    const result = computed(() => {
      if (condition.value) {
        return a.value * 10;
      } else {
        return b.value * 10;
      }
    });
    
    expect(result.value).toBe(10);
    
    // Change unused branch - should not trigger recomputation
    const prevVersion = (result as any)._version;
    b.value = 3;
    expect(result.value).toBe(10);
    // Version shouldn't change if value didn't change
    expect((result as any)._version).toBe(prevVersion);
    
    // Switch condition
    condition.value = false;
    expect(result.value).toBe(30);
  });

  it('should handle diamond dependencies', () => {
    const source = signal(1);
    const left = computed(() => source.value * 2);
    const right = computed(() => source.value * 3);
    const combined = computed(() => left.value + right.value);
    
    expect(combined.value).toBe(5);
    
    source.value = 2;
    expect(combined.value).toBe(10);
  });

  it('should detect cycles', () => {
    let a: any;
    let b: any;
    
    a = computed(() => b.value);
    b = computed(() => a.value);
    
    expect(() => a.value).toThrow('Cycle detected');
  });

  it('should work with effects', () => {
    const s = signal(1);
    const c = computed(() => s.value * 2);
    let effectValue = 0;
    
    effect(() => {
      effectValue = c.value;
    });
    
    expect(effectValue).toBe(2);
    
    s.value = 5;
    expect(effectValue).toBe(10);
  });

  it('should handle very deep chains (1000+ nodes)', () => {
    const depth = 1000;
    const chain: any[] = [signal(0)];
    
    for (let i = 1; i <= depth; i++) {
      const prev = chain[i - 1];
      chain[i] = computed(() => prev.value + 1);
    }
    
    // Should not throw stack overflow
    expect(() => {
      chain[0].value = 1;
      const result = chain[depth].value;
      expect(result).toBe(1001);
    }).not.toThrow();
  });
});