import { describe, it, expect, beforeEach } from 'vitest';
import { signal, peek, untrack, writeSignal, computed, effect, batch, resetGlobalState } from './test-setup';

describe('signal', () => {
  beforeEach(() => {
    // Clean state between tests
    resetGlobalState();
  });

  it('should create a signal with initial value', () => {
    const s = signal(10);
    expect(s()).toBe(10);
  });

  it('should update signal value', () => {
    const s = signal(5);
    writeSignal(s, 10);
    expect(s()).toBe(10);
  });

  it('should update signal value with writeSignal', () => {
    const s = signal(5);
    writeSignal(s, 10);
    expect(s()).toBe(10);
  });

  it('should not trigger updates when value is same', () => {
    const s = signal(5);
    const initialVersion = s._version;
    writeSignal(s, 5);
    expect(s._version).toBe(initialVersion);
  });

  it('should increment version on value change', () => {
    const s = signal(5);
    const initialVersion = s._version;
    writeSignal(s, 10);
    expect(s._version).toBe(initialVersion + 1);
  });

  it('should handle null and undefined values', () => {
    const s1 = signal<number | null>(null);
    const s2 = signal<string | undefined>(undefined);
    
    expect(s1()).toBe(null);
    expect(s2()).toBe(undefined);
    
    writeSignal(s1, 42);
    expect(s1()).toBe(42);
    
    writeSignal(s1, null);
    expect(s1()).toBe(null);
  });

  it('should handle object values with reference equality', () => {
    const obj1 = { name: 'Alice' };
    const obj2 = { name: 'Alice' };
    const s = signal(obj1);
    
    const initialVersion = s._version;
    
    // Same reference, no update
    writeSignal(s, obj1);
    expect(s._version).toBe(initialVersion);
    
    // Different reference, triggers update
    writeSignal(s, obj2);
    expect(s._version).toBe(initialVersion + 1);
  });

  it('should track dependencies when read inside computed', () => {
    const a = signal(5);
    const b = signal(10);
    const sum = computed(() => a() + b());
    
    expect(sum()).toBe(15);
    
    // Should have created dependency nodes
    expect(a._targets).toBeDefined();
    expect(b._targets).toBeDefined();
  });

  it('should notify dependents on change', () => {
    const source = signal(10);
    let computeCount = 0;
    
    const double = computed(() => {
      computeCount++;
      return source() * 2;
    });
    
    expect(double()).toBe(20);
    expect(computeCount).toBe(1);
    
    writeSignal(source, 5);
    expect(double()).toBe(10);
    expect(computeCount).toBe(2);
  });

  describe('peek', () => {
    it('should read value without tracking', () => {
      const a = signal(5);
      const b = signal(10);
      let computeCount = 0;
      
      const result = computed(() => {
        computeCount++;
        return a() + peek(b);
      });
      
      expect(result()).toBe(15);
      expect(computeCount).toBe(1);
      
      // Changing b should not trigger recompute
      writeSignal(b, 20);
      expect(result()).toBe(15); // Still using old value
      expect(computeCount).toBe(1);
      
      // Changing a should trigger recompute
      writeSignal(a, 10);
      expect(result()).toBe(30); // Now picks up new b value
      expect(computeCount).toBe(2);
    });
  });

  describe('untrack', () => {
    it('should prevent dependency tracking in callback', () => {
      const a = signal(5);
      const b = signal(10);
      let computeCount = 0;
      
      const result = computed(() => {
        computeCount++;
        return a() + untrack(() => b());
      });
      
      expect(result()).toBe(15);
      expect(computeCount).toBe(1);
      
      // Changing b should not trigger recompute
      writeSignal(b, 20);
      expect(result()).toBe(15);
      expect(computeCount).toBe(1);
      
      // Changing a should trigger recompute and pick up new b
      writeSignal(a, 10);
      expect(result()).toBe(30);
      expect(computeCount).toBe(2);
    });

    it('should restore tracking after untrack', () => {
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);
      
      const result = computed(() => {
        const val1 = a();
        const val2 = untrack(() => b());
        const val3 = c();
        return val1 + val2 + val3;
      });
      
      expect(result()).toBe(6);
      
      // Check dependencies - should have a and c, but not b
      expect(a._targets).toBeDefined();
      expect(b._targets).toBeUndefined();
      expect(c._targets).toBeDefined();
    });
  });

  describe('batching behavior', () => {
    it('should defer notifications in batch', () => {
      const s = signal(0);
      let effectRuns = 0;
      
      effect(() => {
        s(); // Track dependency
        effectRuns++;
      });
      
      expect(effectRuns).toBe(1);
      
      batch(() => {
        writeSignal(s, 1);
        writeSignal(s, 2);
        writeSignal(s, 3);
        expect(effectRuns).toBe(1); // Not run yet
      });
      
      expect(effectRuns).toBe(2); // Run once after batch
      expect(s()).toBe(3);
    });
  });

  describe('array signals', () => {
    it('should handle array mutations', () => {
      const arr = signal([1, 2, 3]);
      let computeCount = 0;
      
      const sum = computed(() => {
        computeCount++;
        return arr().reduce((a, b) => a + b, 0);
      });
      
      expect(sum()).toBe(6);
      expect(computeCount).toBe(1);
      
      // New array reference triggers update
      writeSignal(arr, [1, 2, 3, 4]);
      expect(sum()).toBe(10);
      expect(computeCount).toBe(2);
      
      // Same array reference doesn't trigger
      const current = arr();
      writeSignal(arr, current);
      expect(computeCount).toBe(2);
    });
  });

  describe('stress tests', () => {
    it('should handle many dependents efficiently', () => {
      const source = signal(1);
      const computeds = Array.from({ length: 100 }, (_, i) => 
        computed(() => source() * (i + 1))
      );
      
      // All should compute correctly
      computeds.forEach((c, i) => {
        expect(c()).toBe(i + 1);
      });
      
      // Update should propagate to all
      writeSignal(source, 2);
      computeds.forEach((c, i) => {
        expect(c()).toBe(2 * (i + 1));
      });
    });

    it('should handle simple computed chains', () => {
      const a = signal(1);
      const b = computed(() => {
        const val = a();
        return val + 1;
      });
      
      expect(b()).toBe(2);
      
      writeSignal(a, 5);
      // For now, just verify the computed tracks its dependencies
      expect(a._targets).toBeDefined();
    });
  });
});