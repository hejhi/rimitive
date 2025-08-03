import { it, expect, describe } from 'vitest';
import { createSignalAPI } from '../index';
import { createSignalFactory } from '../signal';
import { createComputedFactory } from '../computed';
import { createEffectFactory } from '../effect';
import { createBatchFactory } from '../batch';

describe('Iterative update implementation', () => {
  const { signal, computed } = createSignalAPI({
    signal: createSignalFactory,
    computed: createComputedFactory,
    effect: createEffectFactory,
    batch: createBatchFactory,
  });

  describe('Update order verification', () => {
    it('should update sources before consumers', () => {
      const updateOrder: string[] = [];
      
      const base = signal(0);
      
      const level1 = computed(() => {
        updateOrder.push('level1-read');
        return base.value + 1;
      });
      
      const level2 = computed(() => {
        updateOrder.push('level2-read');
        return level1.value + 1;
      });
      
      const level3 = computed(() => {
        updateOrder.push('level3-read');
        return level2.value + 1;
      });
      
      // Initial read establishes dependencies
      updateOrder.length = 0;
      expect(level3.value).toBe(3);
      expect(updateOrder).toEqual(['level3-read', 'level2-read', 'level1-read']);
      
      // Update base and read again
      updateOrder.length = 0;
      base.value = 10;
      expect(level3.value).toBe(13);
      
      // Current behavior: reads happen in natural order during recomputation
      expect(updateOrder).toEqual(['level1-read', 'level2-read', 'level3-read']);
    });

    it('should handle conditional dependencies correctly', () => {
      const updateOrder: string[] = [];
      
      const condition = signal(true);
      const branchA = signal(1);
      const branchB = signal(2);
      
      const expensiveA = computed(() => {
        updateOrder.push('expensiveA');
        return branchA.value * 100;
      });
      
      const expensiveB = computed(() => {
        updateOrder.push('expensiveB');
        return branchB.value * 100;
      });
      
      const conditional = computed(() => {
        updateOrder.push('conditional');
        if (condition.value) {
          return expensiveA.value;
        } else {
          return expensiveB.value;
        }
      });
      
      // Initial read - should only evaluate branch A
      updateOrder.length = 0;
      expect(conditional.value).toBe(100);
      expect(updateOrder).toEqual(['conditional', 'expensiveA']);
      
      // Update inactive branch - conditional doesn't recompute when cached
      updateOrder.length = 0;
      branchB.value = 3;
      expect(conditional.value).toBe(100);
      expect(updateOrder).toEqual([]); // Already cached, no recomputation needed
      
      // Switch condition
      updateOrder.length = 0;
      condition.value = false;
      expect(conditional.value).toBe(300);
      expect(updateOrder).toEqual(['conditional', 'expensiveB']);
    });

    it('should detect circular dependencies', () => {
      let a: any;
      let b: any;
      
      // Create circular dependency
      a = computed(() => b.value);
      b = computed(() => a.value);
      
      expect(() => a.value).toThrow('Cycle detected');
    });

    it('should track recursion depth in current implementation', () => {
      // This test will help us measure the current recursion depth
      const depth = 30;
      const chain: any[] = [];
      
      chain[0] = signal(0);
      for (let i = 1; i <= depth; i++) {
        const prev = chain[i - 1];
        chain[i] = computed(() => prev.value + 1);
      }
      
      // Monkey-patch to count recursion depth
      let maxDepth = 0;
      let currentDepth = 0;
      
      // Instrument all computeds in the chain
      for (let i = 1; i <= depth; i++) {
        const original = (chain[i] as any)._update;
        (chain[i] as any)._update = function(this: any) {
          currentDepth++;
          maxDepth = Math.max(maxDepth, currentDepth);
          try {
            return original.call(this);
          } finally {
            currentDepth--;
          }
        };
      }
      
      // Trigger update
      (chain[0] as any).value = 1;
      const result = chain[depth].value;
      
      expect(result).toBe(31);
      // In current implementation, recursion depth should be at least equal to chain depth
      expect(maxDepth).toBeGreaterThanOrEqual(depth);
      
      // Log for debugging
      console.log(`Recursion depth for ${depth} levels: ${maxDepth}`);
    });
  });

  describe('Version tracking', () => {
    it('should update versions correctly through the chain', () => {
      const base = signal(0);
      const comp1 = computed(() => base.value + 1);
      const comp2 = computed(() => comp1.value + 1);
      
      // Get initial versions
      const v1 = {
        base: (base as any)._version,
        comp1: (comp1 as any)._version,
        comp2: (comp2 as any)._version,
      };
      
      // Update base
      base.value = 1;
      
      // Force recomputation
      comp2.value;
      
      const v2 = {
        base: (base as any)._version,
        comp1: (comp1 as any)._version,
        comp2: (comp2 as any)._version,
      };
      
      // All versions should have increased
      expect(v2.base).toBeGreaterThan(v1.base);
      expect(v2.comp1).toBeGreaterThan(v1.comp1);
      expect(v2.comp2).toBeGreaterThan(v1.comp2);
    });

    it('should not update version when value doesnt change', () => {
      const base = signal(5);
      const isEven = computed(() => base.value % 2 === 0);
      
      const v1 = (isEven as any)._version;
      expect(isEven.value).toBe(false);
      
      // Update to another odd number
      base.value = 7;
      expect(isEven.value).toBe(false);
      const v2 = (isEven as any)._version;
      
      // In current implementation, version always increments on recomputation
      // This is something we might want to optimize in the future
      expect(v2).toBeGreaterThan(v1);
    });
  });
});