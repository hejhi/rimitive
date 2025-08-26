/**
 * ALGORITHM: Push-Pull Reactive Signal Implementation
 * 
 * This module implements the core Signal primitive using a push-pull algorithm:
 * 
 * PUSH PHASE (Write):
 * - When a signal's value changes, it traverses its dependency graph
 * - Marks all transitively dependent nodes as "possibly stale" (INVALIDATED)
 * - Schedules effects for execution after the current batch
 * 
 * PULL PHASE (Read):
 * - When a computed/effect reads a signal, it establishes a dependency edge
 * - The edge tracks version numbers for efficient cache invalidation
 * - This enables automatic dependency discovery during execution
 */
import type { ProducerNode } from './types';
import type { LatticeExtension } from '@lattice/lattice';
import type { DependencyGraph } from './helpers/dependency-graph';
import type { SignalContext } from './context';
import type { WorkQueue } from './helpers/work-queue';
import { CONSTANTS } from './constants';

const { RUNNING, PRODUCER_DIRTY } = CONSTANTS

// Single function interface for both read and write
// The function also implements ProducerNode to expose graph properties
export interface SignalFunction<T = unknown> extends ProducerNode {
  (): T;                    // Read operation
  (value: T): void;         // Write operation
  peek(): T;                // Non-tracking read
}

// Signal state object that gets bound to the function
// This IS the actual signal - no indirection through properties
interface SignalState<T> extends ProducerNode {
  value: T;
  _flags: number;  // Bit field for OBSERVED flag
}

interface SignalFactoryContext extends SignalContext {
  graph: DependencyGraph;
  workQueue: WorkQueue;
}

export function createSignalFactory(ctx: SignalFactoryContext): LatticeExtension<'signal', <T>(value: T) => SignalFunction<T>> {
  const {
    graph: { addEdge, invalidate },
    workQueue: { enqueue, flush },
  } = ctx;
  
  // CLOSURE PATTERN: Create signal with closure-captured state for better V8 optimization
  function createSignal<T>(initialValue: T): SignalFunction<T> {
    // State object captured in closure - no binding needed
    const state: SignalState<T> = {
      __type: 'signal',
      value: initialValue,
      _out: undefined,
      _outTail: undefined,
      _flags: 0,  // Start with no flags set
    };
    
    // Signal function using closure instead of bound this
    const signal = ((...args: [] | [T]): T | void => {
      if (args.length) {
        // WRITE PATH
        const newValue = args[0];
        // Cache current value
        const currValue = state.value;

        if (currValue === newValue) return;

        state.value = newValue;
        // Eliminate double read: cache current flags and set producer dirty
        const currentFlags = state._flags;
        state._flags = currentFlags | PRODUCER_DIRTY;

        // Cache _out for repeat access
        const outEdge = state._out;
        if (!outEdge) return;

        // Invalidate and propagate
        // The invalidate function will skip stale edges automatically
        invalidate(outEdge, enqueue);

        // Batch check and flush
        if (!ctx.batchDepth) flush();
        return;
      }

      // READ PATH
      const consumer = ctx.currentConsumer;

      // Always link if there's a consumer (alien-signals approach)
      if (consumer && consumer._flags & RUNNING) addEdge(state, consumer, ctx.trackingVersion);

      return state.value;
    }) as SignalFunction<T>;
    
    // Add peek method using closure
    signal.peek = () => state.value;
    
    return signal;
  }
  
  return {
    name: 'signal',
    method: createSignal
  };
}

// ALIEN-SIGNALS PATTERN: Export the function-based Signal type
export type Signal<T = unknown> = SignalFunction<T>;

// BACKWARDS COMPATIBILITY: Export interface alias
export type SignalInterface<T = unknown> = SignalFunction<T>;