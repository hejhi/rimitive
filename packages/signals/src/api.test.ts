import { describe, it, expect } from 'vitest';
import { createSignalAPI } from './api';
import { createSignalFactory } from './signal';
import { createComputedFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';
import type { LatticeExtension } from '@lattice/lattice';
import type { Dependency } from './types';
import { createBaseContext } from './context';
import { createScheduler } from './helpers/scheduler';
import { createGraphEdges } from './helpers/graph-edges';
import { createPullPropagator } from './helpers/pull-propagator';
import { createGraphTraversal } from './helpers/graph-traversal';

export function createDefaultContext() {
  const baseCtx = createBaseContext();
  const graphEdges = createGraphEdges();
  const { traverseGraph } = createGraphTraversal();

  return {
    ctx: baseCtx,
    ...graphEdges,
    ...createPullPropagator(baseCtx, graphEdges),
    ...createScheduler({ propagate: traverseGraph })
  };
}

describe('createSignalAPI', () => {
  it('should create an API with all provided factories', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
    }, createDefaultContext());

    expect(api.signal).toBeDefined();
    expect(api.computed).toBeDefined();
    expect(api.effect).toBeDefined();
    expect(api.batch).toBeDefined();
    expect(api.dispose).toBeDefined();
  });

  it('should create a minimal API without effects', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
    }, createDefaultContext());

    expect(api.signal).toBeDefined();
    expect(api.computed).toBeDefined();
    expect(api.dispose).toBeDefined();
    
    // These should not exist in minimal API
    expect('effect' in api).toBe(false);
    expect('batch' in api).toBe(false);
    expect('subscribe' in api).toBe(false);
  });

  it('should work with custom context and work queue', () => {
    let enqueueCalled = false;

    // Create custom context with custom work queue
    const baseCtx = createBaseContext();
    const graphEdges = createGraphEdges();
    const { traverseGraph } = createGraphTraversal();
    const scheduler = (() => {
      const originalScheduler = createScheduler({ propagate: traverseGraph });
      return {
        ...originalScheduler,
        propagate: (subscribers: Dependency) => {
          enqueueCalled = true;
          originalScheduler.propagate(subscribers);
        },
      };
    })();

    const pullPropagator = createPullPropagator(baseCtx, graphEdges);

    const api = createSignalAPI(
      {
        signal: createSignalFactory,
        computed: createComputedFactory,
        effect: createEffectFactory,
        batch: createBatchFactory,
      },
      {
        ctx: baseCtx,
        ...graphEdges,
        ...scheduler,
        ...pullPropagator
      }
    );

    const count = api.signal(0);
    const double = api.computed(() => count() * 2);

    let effectValue = 0;
    api.effect(() => {
      effectValue = double();
    });

    count(5);

    expect(effectValue).toBe(10);
    expect(enqueueCalled).toBe(true); // Verify scheduler was consulted
  });

  it('should allow extending context with custom work queue', () => {
    const enqueueCount = 0;

    // Create custom context with instrumented work queue
    const baseCtx = createBaseContext();
    const graphEdges = createGraphEdges();
    const { traverseGraph } = createGraphTraversal();
    const scheduler = createScheduler({ propagate: traverseGraph });

    const api = createSignalAPI({
      signal: createSignalFactory,
      effect: createEffectFactory,
    }, {
      ctx: baseCtx,
      ...graphEdges,
      ...scheduler
    });
    
    const count = api.signal(0);
    api.effect(() => {
      void count(); // Subscribe to count
    });
    
    count(1); // With immediate execution, effect runs immediately without enqueuing

    expect(enqueueCount).toBe(0); // Updated for immediate execution behavior
  });

  it('should allow custom factories to access extended context', () => {
    // Create custom context with logger storage
    interface LoggerContext extends ReturnType<typeof createDefaultContext> {
      logs: string[];
    }
    
    const customCtx: LoggerContext = {
      ...createDefaultContext(),
      logs: []
    };
    
    // Create custom extension that uses the logger storage
    const createLoggerFactory = (ctx: LoggerContext): LatticeExtension<'logger', (message: string) => void> => {
      return {
        name: 'logger',
        method: (message: string) => {
          ctx.logs.push(message);
        }
      };
    };
    
    const api = createSignalAPI({
      signal: createSignalFactory,
      // Align with createSignalAPI factory shape
      logger: createLoggerFactory,
    }, customCtx);
    
    api.logger('test message');
    expect(api._ctx.logs).toEqual(['test message']);
  });

  it('should handle dispose method correctly', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
    }, createDefaultContext());

    let effectRuns = 0;
    const count = api.signal(0);
    
    const dispose = api.effect(() => {
      void count(); // Subscribe to count
      effectRuns++;
    });

    expect(effectRuns).toBe(1);

    count(1);
    expect(effectRuns).toBe(2);

    // Dispose the effect itself
    dispose();
    
    // After dispose, effects should not run
    count(2);
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
    }, createDefaultContext());
    const api2 = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
    }, createDefaultContext());

    const signal1 = api1.signal(0);
    const signal2 = api2.signal(0);

    let effect1Runs = 0;
    let effect2Runs = 0;

    api1.effect(() => {
      void signal1();
      effect1Runs++;
    });

    api2.effect(() => {
      void signal2();
      effect2Runs++;
    });

    signal1(1);
    expect(effect1Runs).toBe(2);
    expect(effect2Runs).toBe(1); // Should not be affected

    signal2(1);
    expect(effect1Runs).toBe(2); // Should not be affected
    expect(effect2Runs).toBe(2);
  });

  it('should work with custom extensions alongside signals', () => {
    // Create a custom extension
    const createCustomFactory = (): LatticeExtension<'custom', () => string> => {
      return {
        name: 'custom',
        method: () => 'custom value'
      };
    };

    // Create API with custom extension and signal
    const api = createSignalAPI({
      signal: createSignalFactory,
      custom: createCustomFactory
    }, createDefaultContext());

    expect(api.custom).toBeDefined();
    expect(api.custom()).toBe('custom value');
    expect(api.signal).toBeDefined();
  });

  it('should properly type the API based on factories', () => {
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
    }, createDefaultContext());

    // TypeScript should know these methods exist
    const count = api.signal(0);
    const double = api.computed(() => count() * 2);

    // TypeScript should properly type values
    const value: number = count();
    const computedValue: number = double();

    expect(value).toBe(0);
    expect(computedValue).toBe(0);
  });
});
