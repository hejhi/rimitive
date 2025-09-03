import { describe, it, expect } from 'vitest';
import { createSignalAPI } from './api';
import { createSignalFactory, SignalContext } from './signal';
import { ComputedContext, createComputedFactory } from './computed';
import { createEffectFactory, EffectContext } from './effect';
import { createBatchFactory } from './batch';
import type { LatticeExtension } from '@lattice/lattice';
import { createBaseContext, GlobalContext } from './context';
import { createNodeScheduler, type NodeScheduler } from './helpers/node-scheduler';
import { createGraphEdges } from './helpers/graph-edges';
import { createPushPropagator } from './helpers/push-propagator';
import { createPullPropagator } from './helpers/pull-propagator';

export function createDefaultContext(): GlobalContext & SignalContext & EffectContext & ComputedContext {
  const baseCtx = createBaseContext();

  // Create helpers with their dependencies
  const graphEdges = createGraphEdges();
  const pullPropagator = createPullPropagator();
  const pushPropagator = createPushPropagator();
  
  // Extend baseCtx in place to ensure nodeScheduler uses the same context object
  const ctx = Object.assign(baseCtx, {
    graphEdges,
    pushPropagator,
    pullPropagator,
    nodeScheduler: null as unknown as NodeScheduler, // Will be set below
  });
  
  // Now create nodeScheduler with the same ctx object
  const nodeScheduler = createNodeScheduler(
    ctx,
    pullPropagator.pullUpdates
  );
  
  ctx.nodeScheduler = nodeScheduler;
  
  return ctx;
}

describe('createSignalAPI', () => {
  it('should create an API with all provided factories', () => {
    // Cast factories to the contravariant-friendly shape expected by createSignalAPI
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
    let flushCalled = false;
    
    // Create custom context with custom work queue
    const baseCtx = createBaseContext();
    const graphEdges = createGraphEdges();
    const pullPropagator = createPullPropagator();
    const pushPropagator = createPushPropagator();
    
    // Extend baseCtx in place to ensure all components share the same context
    const customCtx = Object.assign(baseCtx, {
      graphEdges,
      pushPropagator,
      pullPropagator,
      nodeScheduler: null as any, // Will be set below
    });
    
    const nodeScheduler = (() => {
      const scheduler = createNodeScheduler(customCtx, pullPropagator.pullUpdates);
      return {
        ...scheduler,
        flush: () => {
          flushCalled = true;
          scheduler.flush();
        }
      };
    })();
    
    customCtx.nodeScheduler = nodeScheduler;
    
    const api = createSignalAPI({
      signal: createSignalFactory,
      computed: createComputedFactory,
      effect: createEffectFactory,
      batch: createBatchFactory,
    }, customCtx);
    
    const count = api.signal(0);
    const double = api.computed(() => count() * 2);
    
    let effectValue = 0;
    api.effect(() => {
      effectValue = double();
    });

    count(5);
    
    expect(effectValue).toBe(10);
    expect(flushCalled).toBe(true);
  });

  it('should allow extending context with custom work queue', () => {
    let enqueueCount = 0;
    
    // Create custom context with instrumented work queue
    const baseCtx = createBaseContext();
    const graphEdges = createGraphEdges();
    const pullPropagator = createPullPropagator();
    const nodeScheduler = (() => {
      const queue = createNodeScheduler(baseCtx, pullPropagator.pullUpdates);
      const originalEnqueue = queue.enqueue;
      queue.enqueue = (node) => {
        enqueueCount++;
        return originalEnqueue(node);
      };
      return queue;
    })();
    const pushPropagator = createPushPropagator();
    const customCtx = {
      ...baseCtx,
      graphEdges,
      pushPropagator,
      pullPropagator,
      nodeScheduler,
    };
    
    const api = createSignalAPI({
      signal: createSignalFactory,
      effect: createEffectFactory,
    }, customCtx);
    
    const count = api.signal(0);
    api.effect(() => {
      void count(); // Subscribe to count
    });
    
    count(1); // Should enqueue the effect
    
    expect(enqueueCount).toBe(1);
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
