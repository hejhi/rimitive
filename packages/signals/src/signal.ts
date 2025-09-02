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
import type { GlobalContext } from './context';
import { CONSTANTS } from './constants';
import { GraphEdges } from './helpers/graph-edges';
import { PushPropagator } from './helpers/push-propagator';
import { NodeScheduler } from './helpers/node-scheduler';

const { HAS_CHANGED } = CONSTANTS;

// Single function interface for both read and write
// The function also implements ProducerNode to expose graph properties
export interface SignalFunction<T = unknown> extends ProducerNode {
  (): T;                    // Read operation
  (value: T): void;         // Write operation
  peek(): T;                // Non-tracking read
}

export type SignalContext = GlobalContext & {
  graphEdges: GraphEdges;
  pushPropagator: PushPropagator;
  nodeScheduler: NodeScheduler;
};

// Signal state object that gets bound to the function
// This IS the actual signal - no indirection through properties
interface SignalState<T> extends ProducerNode {
  value: T;
  _flags: number;  // Bit field for various node flags
}

export function createSignalFactory(ctx: SignalContext): LatticeExtension<'signal', <T>(value: T) => SignalFunction<T>> {
  const {
    graphEdges: { addEdge },
    pushPropagator: { pushUpdates },
    nodeScheduler: { flush },
  } = ctx;
  
  // CLOSURE PATTERN: Create signal with closure-captured state for better V8 optimization
  function createSignal<T>(initialValue: T): SignalFunction<T> {
    // State object captured in closure - no binding needed
    const state: SignalState<T> = {
      __type: 'signal',
      value: initialValue,
      _out: undefined,
      _outTail: undefined,
      _flags: 0,  // Start in clean state with no properties
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

        const outEdge = state._out;

        if (!outEdge) return;

        // Only add HAS_CHANGED property if not already set (first change only)
        // No need to set if unobserved since it's only used during propagation
        // Cache flags to avoid double read in hot path
        const flags = state._flags;
        if (!(flags & HAS_CHANGED)) {
          state._flags = flags | HAS_CHANGED;
        }

        // Invalidate and propagate
        // The pushUpdates function will skip stale edges automatically
        pushUpdates(outEdge);

        // Batch check and flush
        if (!ctx.batchDepth) flush();
        return;
      }

      // READ PATH
      const consumer = ctx.currentConsumer;

      // Always link if there's a consumer (alien-signals approach)
      // Create edge to consumer
      if (consumer) addEdge(state, consumer);

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