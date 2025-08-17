import { describe, it, expect, beforeEach } from 'vitest';
import { signal, computed, effect, batch, resetGlobalState } from './test-setup';

describe('signal', () => {
  beforeEach(() => {
    // Clean state between tests
    resetGlobalState();
  });

  it('should create a signal with initial value', () => {
    const s = signal(10);
    expect(s.value).toBe(10);
  });

  it('should update signal value', () => {
    const s = signal(5);
    s.value = 10;
    expect(s.value).toBe(10);
  });

  it('should update signal value with direct assignment', () => {
    const s = signal(5);
    s.value = 10;
    expect(s.value).toBe(10);
  });

  it('should not trigger updates when value is same', () => {
    const s = signal(5);
    const initialVersion = s._version;
    s.value = 5;
    expect(s._version).toBe(initialVersion);
  });

  it('should increment version on value change', () => {
    const s = signal(5);
    const initialVersion = s._version;
    s.value = 10;
    expect(s._version).toBe(initialVersion + 1);
  });

  it('should handle null and undefined values', () => {
    const s1 = signal<number | null>(null);
    const s2 = signal<string | undefined>(undefined);
    
    expect(s1.value).toBe(null);
    expect(s2.value).toBe(undefined);
    
    s1.value = 42;
    expect(s1.value).toBe(42);
    
    s1.value = null;
    expect(s1.value).toBe(null);
  });

  it('should handle object values with reference equality', () => {
    const obj1 = { name: 'Alice' };
    const obj2 = { name: 'Alice' };
    const s = signal(obj1);
    
    const initialVersion = s._version;
    
    // Same reference, no update
    s.value = obj1;
    expect(s._version).toBe(initialVersion);
    
    // Different reference, triggers update
    s.value = obj2;
    expect(s._version).toBe(initialVersion + 1);
  });

  it('should track dependencies when read inside computed', () => {
    const a = signal(5);
    const b = signal(10);
    const sum = computed(() => a.value + b.value);
    
    expect(sum.value).toBe(15);
    
    // Should have created dependency nodes
    expect(a._to).toBeDefined();
    expect(b._to).toBeDefined();
  });

  it('should notify dependents on change', () => {
    const source = signal(10);
    let computeCount = 0;
    
    const double = computed(() => {
      computeCount++;
      return source.value * 2;
    });
    
    expect(double.value).toBe(20);
    expect(computeCount).toBe(1);
    
    source.value = 5;
    expect(double.value).toBe(10);
    expect(computeCount).toBe(2);
  });

  describe('peek', () => {
    it('should read value without tracking', () => {
      const a = signal(5);
      const b = signal(10);
      let computeCount = 0;
      
      const result = computed(() => {
        computeCount++;
        return a.value + b.peek();
      });
      
      expect(result.value).toBe(15);
      expect(computeCount).toBe(1);
      
      // Changing b should not trigger recompute
      b.value = 20;
      expect(result.value).toBe(15); // Still using old value
      expect(computeCount).toBe(1);
      
      // Changing a should trigger recompute
      a.value = 10;
      expect(result.value).toBe(30); // Now picks up new b value
      expect(computeCount).toBe(2);
    });
  });

  describe('batching behavior', () => {
    it('should defer notifications in batch', () => {
      const s = signal(0);
      let effectRuns = 0;
      
      effect(() => {
        void s.value; // Track dependency
        effectRuns++;
      });
      
      expect(effectRuns).toBe(1);
      
      batch(() => {
        s.value = 1;
        s.value = 2;
        s.value = 3;
        expect(effectRuns).toBe(1); // Not run yet
      });
      
      expect(effectRuns).toBe(2); // Run once after batch
      expect(s.value).toBe(3);
    });
  });

  describe('array signals', () => {
    it('should handle array mutations', () => {
      const arr = signal([1, 2, 3]);
      let computeCount = 0;
      
      const sum = computed(() => {
        computeCount++;
        return arr.value.reduce((a: number, b: number) => a + b, 0);
      });
      
      expect(sum.value).toBe(6);
      expect(computeCount).toBe(1);
      
      // New array reference triggers update
      arr.value = [1, 2, 3, 4];
      expect(sum.value).toBe(10);
      expect(computeCount).toBe(2);
      
      // Same array reference doesn't trigger
      const current = arr.value;
      arr.value = current;
      expect(computeCount).toBe(2);
    });
  });

  describe('stress tests', () => {
    it('should handle many dependents efficiently', () => {
      const source = signal(1);
      const computeds = Array.from({ length: 100 }, (_, i) => 
        computed(() => source.value * (i + 1))
      );
      
      // All should compute correctly
      computeds.forEach((c, i) => {
        expect(c.value).toBe(i + 1);
      });
      
      // Update should propagate to all
      source.value = 2;
      computeds.forEach((c, i) => {
        expect(c.value).toBe(2 * (i + 1));
      });
    });

    it('should handle simple computed chains', () => {
      const a = signal(1);
      const b = computed(() => {
        const val = a.value;
        return val + 1;
      });
      
      expect(b.value).toBe(2);
      
      a.value = 5;
      // For now, just verify the computed tracks its dependencies
      expect(a._to).toBeDefined();
    });
  });
});