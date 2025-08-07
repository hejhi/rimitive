import { describe, it, expect } from 'vitest';
import { createSignalAPI } from './api';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';
import { createSubscribeFactory } from './subscribe';
import type { LatticeExtension } from '@lattice/lattice';
import { createContext } from './context';
import { createWorkQueue } from './helpers/work-queue';
import { createContext as createLattice } from '@lattice/lattice';

describe('createSignalAPI', () => {
  it('should create an API with all provided factories', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
      subscribe: createSubscribeFactory,
    });

    expect(api.signal).toBeDefined();
    expect(api.computed).toBeDefined();
    expect(api.effect).toBeDefined();
    expect(api.batch).toBeDefined();
    expect(api.subscribe).toBeDefined();
    expect(api.dispose).toBeDefined();
  });

  it('should create a minimal API without effects', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
    });

    expect(api.signal).toBeDefined();
    expect(api.computed).toBeDefined();
    expect(api.dispose).toBeDefined();
    
    // These should not exist in minimal API
    expect('effect' in api).toBe(false);
    expect('batch' in api).toBe(false);
    expect('subscribe' in api).toBe(false);
  });

  it('should work with custom work queue implementation', () => {
    let flushCalled = false;
    
    // Create custom context and API manually for custom work queue
    const ctx = createContext();
    const customWorkQueue = (() => {
      const queue = createWorkQueue();
      return {
        ...queue,
        flush: () => {
          flushCalled = true;
          queue.flush();
        }
      };
    })();
    
    const signalApi = { workQueue: customWorkQueue };
    
    const api = createLattice(
      createSignalFactory(ctx, signalApi),
      createComputedFactory(ctx, signalApi),
      createEffectFactory(ctx, signalApi),
      createBatchFactory(ctx, signalApi),
      createSubscribeFactory(ctx, signalApi)
    );
    
    const count = api.signal(0);
    const double = api.computed(() => count.value * 2);
    
    let effectValue = 0;
    api.effect(() => {
      effectValue = double.value;
    });

    count.value = 5;
    
    expect(effectValue).toBe(10);
    expect(flushCalled).toBe(true);
  });

  it('should handle dispose method correctly', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
      subscribe: createSubscribeFactory,
    });

    let effectRuns = 0;
    const count = api.signal(0);
    
    const dispose = api.effect(() => {
      count.value; // Subscribe to count
      effectRuns++;
    });

    expect(effectRuns).toBe(1);

    count.value = 1;
    expect(effectRuns).toBe(2);

    // Dispose the effect itself
    dispose();
    
    // After dispose, effects should not run
    count.value = 2;
    expect(effectRuns).toBe(2); // Should still be 2
    
    // api.dispose() disposes the context, not individual effects
    api.dispose();
  });

  it('should support multiple independent APIs', () => {
    const api1 = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
      subscribe: createSubscribeFactory,
    });
    const api2 = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
      subscribe: createSubscribeFactory,
    });

    const signal1 = api1.signal(0);
    const signal2 = api2.signal(0);

    let effect1Runs = 0;
    let effect2Runs = 0;

    api1.effect(() => {
      signal1.value;
      effect1Runs++;
    });

    api2.effect(() => {
      signal2.value;
      effect2Runs++;
    });

    signal1.value = 1;
    expect(effect1Runs).toBe(2);
    expect(effect2Runs).toBe(1); // Should not be affected

    signal2.value = 1;
    expect(effect1Runs).toBe(2); // Should not be affected
    expect(effect2Runs).toBe(2);
  });

  it('should work with custom extensions alongside signals', () => {
    // Create a custom extension
    const createCustomFactory = (_ctx: typeof createContext extends () => infer R ? R : never): LatticeExtension<'custom', () => string> => {
      return {
        name: 'custom',
        method: () => 'custom value'
      };
    };

    // Create API with custom extension
    const ctx = createContext();
    const signalApi = { workQueue: createWorkQueue() };
    
    const api = createLattice(
      createSignalFactory(ctx, signalApi),
      createCustomFactory(ctx)
    );

    expect(api.custom).toBeDefined();
    expect(api.custom()).toBe('custom value');
    expect(api.signal).toBeDefined();
  });

  it('should properly type the API based on factories', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
    });

    // TypeScript should know these methods exist
    const count = api.signal(0);
    const double = api.computed(() => count.value * 2);

    // TypeScript should properly type values
    const value: number = count.value;
    const computedValue: number = double.value;

    expect(value).toBe(0);
    expect(computedValue).toBe(0);
  });
});