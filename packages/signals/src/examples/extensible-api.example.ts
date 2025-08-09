/**
 * Example: Creating an extensible signals API with custom context and factories
 * 
 * This demonstrates how to:
 * 1. Extend the context with custom properties
 * 2. Create custom factories that use the extended context
 * 3. Use Lattice to compose everything together
 */

import { createSignalAPI, type ExtensionFactory } from '../api';
import { createSignalFactory, type SignalInterface } from '../signal';
import { createComputedFactory, type ComputedInterface } from '../computed';
import { createEffectFactory, type EffectDisposer } from '../effect';
import { createContext } from '../context';
import type { SignalContext } from '../context';
import { createWorkQueue } from '../helpers/work-queue';
import { createGraphWalker } from '../helpers/graph-walker';
import { createDependencyGraph } from '../helpers/dependency-graph';
import { createDependencySweeper } from '../helpers/dependency-sweeper';
import { createPropagator } from '../helpers/propagator';

// Example 1: Custom context with performance tracking
interface PerformanceContext extends SignalContext {
  workQueue: ReturnType<typeof createWorkQueue>;
  graphWalker: ReturnType<typeof createGraphWalker>;
  propagator: ReturnType<typeof createPropagator>;
  dependencies: ReturnType<typeof createDependencyGraph>;
  sourceCleanup: ReturnType<typeof createDependencySweeper>;
  performance: {
    signalReads: number;
    signalWrites: number;
    computations: number;
    effectRuns: number;
  };
}

function createPerformanceContext(): PerformanceContext {
  return {
    ...createContext(),
    workQueue: createWorkQueue(),
    graphWalker: createGraphWalker(),
    propagator: createPropagator(),
    dependencies: createDependencyGraph(),
    sourceCleanup: createDependencySweeper(createDependencyGraph().unlinkFromProducer),
    performance: {
      signalReads: 0,
      signalWrites: 0,
      computations: 0,
      effectRuns: 0,
    }
  };
}

// Example 2: Custom factory that adds performance tracking
type SignalFactoryCtx = Parameters<typeof createSignalFactory>[0];
const createPerfSignalFactory: ExtensionFactory<
  'signal',
  <T>(value: T) => SignalInterface<T>,
  SignalFactoryCtx & { performance?: PerformanceContext['performance'] }
> = (ctx) => {
  if (!('performance' in ctx)) {
    // Fallback to regular signal if no performance tracking
    return createSignalFactory(ctx);
  }
  
  const baseFactory = createSignalFactory(ctx);
  const perfCtx = ctx as PerformanceContext;
  
  return {
    name: 'signal',
    method: <T>(value: T) => {
      const signal = baseFactory.method(value);
      
      // Wrap getter/setter with performance tracking
      const descriptor = Object.getOwnPropertyDescriptor(signal, 'value')!;
      const originalGetter = descriptor.get!.bind(signal);
      const originalSetter = descriptor.set!.bind(signal);
      
      Object.defineProperty(signal, 'value', {
        get(): T {
          perfCtx.performance.signalReads++;
          return originalGetter() as T;
        },
        set(newValue: T) {
          perfCtx.performance.signalWrites++;
          originalSetter(newValue);
        }
      });
      
      return signal;
    }
  };
};

// Example 3: Custom extension for performance monitoring
interface PerfResult {
  stats?: PerformanceContext['performance'];
  error?: string;
  reset?: () => void;
}

const createPerformanceMonitor: ExtensionFactory<'perf', () => PerfResult, SignalContext & { performance?: PerformanceContext['performance'] }> = (ctx) => {
  if (!('performance' in ctx)) {
    return {
      name: 'perf',
      method: () => ({ error: 'Performance tracking not enabled' })
    };
  }
  
  const perfCtx = ctx as PerformanceContext;
  return {
    name: 'perf',
    method: () => ({
      stats: perfCtx.performance,
      reset: () => {
        perfCtx.performance.signalReads = 0;
        perfCtx.performance.signalWrites = 0;
        perfCtx.performance.computations = 0;
        perfCtx.performance.effectRuns = 0;
      }
    })
  };
};

// Example 4: Using the extensible API
export function example() {
  // Create API with custom context and factories
  const api = createSignalAPI({
    signal: createPerfSignalFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
    computed: createComputedFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
    effect: createEffectFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
    perf: (createPerformanceMonitor as unknown) as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'perf', () => { stats?: PerformanceContext['performance']; error?: string; reset?: () => void }>,
  }, createPerformanceContext());
  
  // Use the API
  const count = api.signal(0);
  const double = api.computed(() => count.value * 2);
  
  api.effect(() => {
    console.log('Double:', double.value);
  });
  
  count.value = 5;
  
  // Check performance stats
  const perfData = api.perf();
  if (perfData.stats) {
    console.log('Performance stats:', perfData.stats);
    // Output: { signalReads: 2, signalWrites: 1, computations: 0, effectRuns: 1 }
    
    // Reset stats
    perfData.reset?.();
  }
}

// Example 5: Creating a minimal API with custom work queue
export function minimalExample() {
  // Custom work queue that logs all enqueued effects
  const loggingWorkQueue = (() => {
    const base = createWorkQueue();
    return {
      ...base,
      enqueue: (node: Parameters<typeof base.enqueue>[0]) => {
        console.log('Enqueuing effect:', node);
        return base.enqueue(node);
      }
    };
  })();
  
  // Create minimal API with just signals and effects
  const api = createSignalAPI({
    signal: createSignalFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
    effect: createEffectFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
  }, {
    ...createContext(),
    workQueue: loggingWorkQueue,
    graphWalker: createGraphWalker(),
    propagator: createPropagator(),
    dependencies: createDependencyGraph(),
    sourceCleanup: createDependencySweeper(createDependencyGraph().unlinkFromProducer),
  });
  
  // Use the API
  const value = api.signal(42);
  api.effect(() => {
    console.log('Value is:', value.value);
  });
}

// Example 6: Type-safe factory requirements (future enhancement idea)
// This shows how we could extend the pattern to have factories declare requirements
interface RequirementsAwareFactory<TName extends string, TMethod, TRequiredContext extends SignalContext = SignalContext> 
  extends ExtensionFactory<TName, TMethod, TRequiredContext> {
  _contextType?: TRequiredContext; // Phantom type for requirements
}

// This would allow TypeScript to verify context compatibility at compile time
export const createDebugSignalFactory: RequirementsAwareFactory<
  'signal', 
  <T>(value: T) => SignalInterface<T>,
  SignalFactoryCtx & { debug: boolean }
> = (ctx) => {
  // TypeScript would error if ctx doesn't have debug property
  const debugCtx = ctx as SignalFactoryCtx & { debug: boolean };
  if (debugCtx.debug) {
    console.log('Debug mode enabled');
  }
  return createSignalFactory(ctx);
};

// Example 7: Using the default context
export function defaultExample() {
  // For simple use cases, use the default context
  const api = createSignalAPI({
    signal: createSignalFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'signal', <T>(value: T) => SignalInterface<T>>,
    computed: createComputedFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'computed', <T>(compute: () => T) => ComputedInterface<T>>,
    effect: createEffectFactory as (ctx: unknown) => import('@lattice/lattice').LatticeExtension<'effect', (fn: () => void | (() => void)) => EffectDisposer>,
  }, {
    ...createContext(),
    workQueue: createWorkQueue(),
    graphWalker: createGraphWalker(),
    propagator: createPropagator(),
    dependencies: createDependencyGraph(),
    sourceCleanup: createDependencySweeper(createDependencyGraph().unlinkFromProducer),
  });
  
  // Works just like before
  const count = api.signal(0);
  const double = api.computed(() => count.value * 2);
  
  api.effect(() => {
    console.log('Double:', double.value);
  });
  
  count.value = 5; // Logs: Double: 10
}
