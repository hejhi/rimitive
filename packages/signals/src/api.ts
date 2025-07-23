// Main API that creates all signal functions with shared context
import { createContext } from './context';
import { createSignalFactory } from './signal';
import { createComputedFactory, createUntrackFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';

// Create the default shared context and all functions
const defaultContext = createContext();
export const signal = createSignalFactory(defaultContext);
export const computed = createComputedFactory(defaultContext);
export const effect = createEffectFactory(defaultContext);
export const batch = createBatchFactory(defaultContext);
export const untrack = createUntrackFactory(defaultContext);

// Export the context for testing/debugging
export { defaultContext as activeContext };

// Factory for creating isolated signal APIs
export function createSignalAPI() {
  const ctx = createContext();
  
  return {
    signal: createSignalFactory(ctx),
    computed: createComputedFactory(ctx),
    effect: createEffectFactory(ctx),
    batch: createBatchFactory(ctx),
    untrack: createUntrackFactory(ctx),
    _ctx: ctx,
  };
}