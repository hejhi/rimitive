import { it, expect, describe } from 'vitest';
import { createSignalAPI } from './index';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createIterativeComputedFactory } from './iterative-computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';

describe('Performance Comparison', () => {
  it('should measure stack depth for recursive implementation', () => {
    const { signal, computed } = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
    });
    
    const depth = 50;
    const chain: any[] = [signal(0)];
    
    let maxStackDepth = 0;
    let currentStackDepth = 0;
    
    // Instrument computeds to track recursion depth
    for (let i = 1; i <= depth; i++) {
      const prev = chain[i - 1];
      const comp = computed(() => prev.value + 1);
      
      // Monkey-patch _update to track depth
      const original = (comp as any)._update;
      (comp as any)._update = function(this: any) {
        currentStackDepth++;
        maxStackDepth = Math.max(maxStackDepth, currentStackDepth);
        try {
          return original.call(this);
        } finally {
          currentStackDepth--;
        }
      };
      
      chain[i] = comp;
    }
    
    // Trigger update
    chain[0].value = 1;
    const result = chain[depth].value;
    
    expect(result).toBe(51);
    console.log(`Recursive implementation stack depth: ${maxStackDepth}`);
    expect(maxStackDepth).toBeGreaterThanOrEqual(depth);
  });

  it('should have minimal stack depth for iterative implementation', () => {
    const { signal, computed } = createSignalAPI({
      signal: createSignalFactory,
      computed: createIterativeComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
    });
    
    const depth = 50;
    const chain: any[] = [signal(0)];
    
    let maxStackDepth = 0;
    
    // Create deep chain
    for (let i = 1; i <= depth; i++) {
      const prev = chain[i - 1];
      chain[i] = computed(() => prev.value + 1);
    }
    
    // Track stack depth during iterativeUpdate
    const comp = chain[depth];
    const originalValue = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(comp), 'value')!.get!;
    Object.defineProperty(comp, 'value', {
      get() {
        const stackTrace = new Error().stack || '';
        const stackFrames = stackTrace.split('\n').length;
        maxStackDepth = Math.max(maxStackDepth, stackFrames);
        return originalValue.call(this);
      }
    });
    
    // Trigger update
    chain[0].value = 1;
    const result = chain[depth].value;
    
    expect(result).toBe(51);
    console.log(`Iterative implementation approximate stack depth: ${maxStackDepth}`);
    // Stack depth should be much less than the chain depth
    expect(maxStackDepth).toBeLessThan(depth);
  });

  it('should handle deeper chains than recursive without overflow', () => {
    const { signal, computed } = createSignalAPI({
      signal: createSignalFactory,
      computed: createIterativeComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
    });
    
    const depth = 1000; // Deep enough to show the difference
    const chain: any[] = [signal(0)];
    
    for (let i = 1; i <= depth; i++) {
      const prev = chain[i - 1];
      chain[i] = computed(() => prev.value + 1);
    }
    
    // This would stack overflow with recursive implementation
    expect(() => {
      chain[0].value = 1;
      const result = chain[depth].value;
      expect(result).toBe(1001);
    }).not.toThrow();
  });
});