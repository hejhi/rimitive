import { it, expect, describe } from 'vitest';
import { createSignalAPI } from '../index';
import { createSignalFactory } from '../signal';
import { createComputedFactory } from '../computed';
import { createEffectFactory } from '../effect';
import { createBatchFactory } from '../batch';

describe('Iterative traversal correctness', () => {
  const { signal, computed, effect } = createSignalAPI({
    signal: createSignalFactory,
    computed: createComputedFactory,
    effect: createEffectFactory,
    batch: createBatchFactory,
  });

  describe('Deep chains', () => {
    it('should handle deep chains (100+ levels)', () => {
      const chain: Array<ReturnType<typeof signal<number>> | ReturnType<typeof computed<number>>> = [];
      
      // Create base signal
      chain[0] = signal(0);
      
      // Create deep chain
      for (let i = 1; i <= 100; i++) {
        const prev = chain[i - 1]!;
        chain[i] = computed(() => prev.value + 1);
      }
      
      // Verify initial values
      expect(chain[100]!.value).toBe(100);
      
      // Update base and verify propagation
      (chain[0] as ReturnType<typeof signal<number>>).value = 10;
      expect(chain[100]!.value).toBe(110);
    });

    it('should handle very deep chains (1000+ levels) without stack overflow', () => {
      const chain: Array<ReturnType<typeof signal<number>> | ReturnType<typeof computed<number>>> = [];
      
      // Create base signal
      chain[0] = signal(0);
      
      // Create very deep chain
      for (let i = 1; i <= 1000; i++) {
        const prev = chain[i - 1]!;
        chain[i] = computed(() => prev.value + 1);
      }
      
      // This should not throw stack overflow
      expect(() => chain[1000]!.value).not.toThrow();
      expect(chain[1000]!.value).toBe(1000);
    });
  });

  describe('Wide graphs', () => {
    it('should handle wide graphs (many siblings)', () => {
      const base = signal(0);
      const siblings: Array<ReturnType<typeof computed<number>>> = [];
      
      // Create 100 direct dependents
      for (let i = 0; i < 100; i++) {
        siblings[i] = computed(() => base.value + i);
      }
      
      // Create a final computed that depends on all siblings
      const final = computed(() => {
        let sum = 0;
        for (const sibling of siblings) {
          sum += sibling.value;
        }
        return sum;
      });
      
      // Initial sum: 0+0 + 0+1 + 0+2 + ... + 0+99 = 4950
      expect(final.value).toBe(4950);
      
      // Update base
      base.value = 1;
      // New sum: 1+0 + 1+1 + 1+2 + ... + 1+99 = 100 + 4950 = 5050
      expect(final.value).toBe(5050);
    });
  });

  describe('Mixed conditional/unconditional dependencies', () => {
    it('should handle mixed dependency patterns', () => {
      const condA = signal(true);
      const condB = signal(true);
      const valA = signal(1);
      const valB = signal(2);
      const valC = signal(3);
      
      const compA = computed(() => condA.value ? valA.value : 0);
      const compB = computed(() => condB.value ? valB.value : 0);
      const compC = computed(() => valC.value); // Always depends on valC
      
      const final = computed(() => compA.value + compB.value + compC.value);
      
      expect(final.value).toBe(6); // 1 + 2 + 3
      
      // Turn off condA
      condA.value = false;
      expect(final.value).toBe(5); // 0 + 2 + 3
      
      // Update valA (should not affect final since condA is false)
      valA.value = 10;
      expect(final.value).toBe(5); // Still 0 + 2 + 3
      
      // Turn condA back on
      condA.value = true;
      expect(final.value).toBe(15); // 10 + 2 + 3
    });
  });

  describe('Circular dependencies', () => {
    it('should detect and throw on circular dependencies', () => {
      const a = signal(0);
      let bRef: ReturnType<typeof computed<number>>;
      
      const b = computed(() => {
        // Create circular dependency
        if (a.value > 0 && bRef) {
          return bRef.value + 1; // This creates a cycle
        }
        return a.value;
      });
      bRef = b;
      
      // First access is fine
      expect(b.value).toBe(0);
      
      // This should throw when cycle is detected
      a.value = 1;
      expect(() => b.value).toThrow('Cycle detected');
    });
  });

  describe('Disposed nodes during traversal', () => {
    it('should handle disposed nodes gracefully', () => {
      const base = signal(0);
      const comp1 = computed(() => base.value + 1);
      const comp2 = computed(() => comp1.value + 1);
      const comp3 = computed(() => comp2.value + 1);
      
      let effectCount = 0;
      const e = effect(() => {
        effectCount++;
        comp3.value; // Subscribe to comp3
      });
      
      expect(effectCount).toBe(1);
      
      // Dispose middle computed
      comp2.dispose();
      
      // Update should not propagate through disposed node
      base.value = 1;
      expect(effectCount).toBe(1); // Effect should not re-run
      
      // comp3 should still have old value
      expect(() => comp3.value).not.toThrow();
    });
  });

  describe('Errors during source updates', () => {
    it('should handle errors in computed functions', () => {
      const base = signal(0);
      const errorComp = computed(() => {
        if (base.value > 0) {
          throw new Error('Test error');
        }
        return base.value;
      });
      
      const dependent = computed(() => {
        try {
          return errorComp.value;
        } catch {
          return -1; // Default on error
        }
      });
      
      expect(dependent.value).toBe(0);
      
      base.value = 1;
      expect(dependent.value).toBe(-1); // Should handle error gracefully
    });
  });

  describe('Version tracking', () => {
    it('should correctly track versions through updates', () => {
      const base = signal(0);
      const comp1 = computed(() => base.value * 2);
      const comp2 = computed(() => comp1.value + 1);
      
      // Track versions
      const getVersions = () => ({
        base: (base as any)._version,
        comp1: (comp1 as any)._version,
        comp2: (comp2 as any)._version,
      });
      
      const v1 = getVersions();
      
      // Update base
      base.value = 1;
      const v2 = getVersions();
      
      // All versions should increase
      expect(v2.base).toBeGreaterThan(v1.base);
      expect(v2.comp1).toBeGreaterThan(v1.comp1);
      expect(v2.comp2).toBeGreaterThan(v1.comp2);
      
      // Update base to same value
      base.value = 1;
      const v3 = getVersions();
      
      // Base version increases but computeds should not
      expect(v3.base).toBeGreaterThan(v2.base);
      expect(v3.comp1).toBe(v2.comp1);
      expect(v3.comp2).toBe(v2.comp2);
    });
  });
});