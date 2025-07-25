import { describe, it, expect } from 'vitest';
import { createSignalAPI } from './api';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';
import type { LatticeExtension } from '@lattice/lattice';
import type { SignalContext } from './context';

describe('createSignalAPI', () => {
  it('should create an API with all provided factories', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
    });

    expect(api.signal).toBeDefined();
    expect(api.computed).toBeDefined();
    expect(api.effect).toBeDefined();
    expect(api.batch).toBeDefined();
    expect(api._ctx).toBeDefined();
    expect(api.dispose).toBeDefined();
  });

  it('should share the same context across all factories', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
    });

    // Create a signal and computed that depends on it
    const s = api.signal(1);
    const c = api.computed(() => s.value * 2);

    // Initial values
    expect(c.value).toBe(2);

    // Update signal - if context is shared, computed should update
    s.value = 3;
    expect(c.value).toBe(6);

    // Check context counters are shared
    const initialVersion = api._ctx.version;
    s.value = 4;
    expect(api._ctx.version).toBe(initialVersion + 1);
  });

  it('should work with custom factories', () => {
    // Create a custom factory
    const createCustomFactory = (ctx: SignalContext): LatticeExtension<'custom', () => string> => ({
      name: 'custom',
      method: () => `Context version: ${ctx.version}`
    });

    const api = createSignalAPI({
      signal: createSignalFactory,
      custom: createCustomFactory,
    });

    expect(api.custom).toBeDefined();
    expect(api.custom()).toBe('Context version: 0');

    // Update signal to increment version
    const s = api.signal(1);
    s.value = 2;
    expect(api.custom()).toBe('Context version: 1');
  });

  it('should properly type the API based on factories', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
    });

    // TypeScript should know these methods exist
    const s = api.signal(42);
    const c = api.computed(() => s.value);

    // TypeScript should know the return types
    const value: number = s.value;
    const computedValue: number = c.value;

    expect(value).toBe(42);
    expect(computedValue).toBe(42);
  });

  it('should handle dispose method correctly', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      effect: createEffectFactory,
    });

    let effectRuns = 0;
    const s = api.signal(0);
    
    const dispose = api.effect(() => {
      s.value; // Track the signal
      effectRuns++;
    });

    expect(effectRuns).toBe(1);

    s.value = 1;
    expect(effectRuns).toBe(2);

    // Dispose the effect
    dispose();

    s.value = 2;
    expect(effectRuns).toBe(2); // Should not run again

    // API dispose method should clean up the context
    api.dispose();
    
    // After dispose, the API should still be usable but with a fresh context
    const s2 = api.signal(10);
    expect(s2.value).toBe(10);
  });

  it('should expose context for advanced usage', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
    });

    // Access to context for debugging/testing
    expect(api._ctx.version).toBe(0);
    expect(api._ctx.batchDepth).toBe(0);
    expect(api._ctx.currentComputed).toBe(null);
    
    // Can inspect pool statistics
    expect(api._ctx.allocations).toBe(0);
    expect(api._ctx.poolHits).toBe(0);
    expect(api._ctx.poolMisses).toBe(0);
  });

  it('should support multiple independent APIs', () => {
    const api1 = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
    });

    const api2 = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
    });

    // Each API should have its own context
    expect(api1._ctx).not.toBe(api2._ctx);

    // Changes in one API should not affect the other
    const s1 = api1.signal(1);
    const s2 = api2.signal(2);

    const c1 = api1.computed(() => s1.value * 10);
    const c2 = api2.computed(() => s2.value * 10);

    expect(c1.value).toBe(10);
    expect(c2.value).toBe(20);

    s1.value = 3;
    expect(c1.value).toBe(30);
    expect(c2.value).toBe(20); // Should not change

    // Context versions should be independent
    expect(api1._ctx.version).toBe(1);
    expect(api2._ctx.version).toBe(0);
  });
});