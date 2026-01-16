import type { InstrumentationContext } from '@rimitive/core';

/**
 * Signals-specific instrumentation state.
 * Shared between signal/computed/effect/graphEdges instrument hooks.
 * @internal
 */
export type SignalsInstrState = {
  /** Map reactive nodes to their instrumentation IDs */
  nodeIds: WeakMap<object, string>;
  /** Stack of pending producer IDs for dependency tracking */
  pendingProducerIdStack: string[];
};

/** Symbol key for storing signals state on the context object */
const SIGNALS_STATE = Symbol('signals-instr-state');

/** Context with signals state attached */
type ContextWithState = InstrumentationContext & {
  [SIGNALS_STATE]?: SignalsInstrState;
};

/**
 * Get or create the signals instrumentation state for a context.
 * Stores state directly on the context object using a symbol key.
 * Called by signal/computed/effect/graphEdges instrument hooks.
 */
export function getInstrState(instr: InstrumentationContext): SignalsInstrState {
  const ctx = instr as ContextWithState;

  if (!ctx[SIGNALS_STATE]) {
    ctx[SIGNALS_STATE] = {
      nodeIds: new WeakMap(),
      pendingProducerIdStack: [],
    };
  }

  return ctx[SIGNALS_STATE];
}
