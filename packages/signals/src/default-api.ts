// Default API with all features for backwards compatibility
// This file imports everything, so it's NOT tree-shakeable
// Users who want tree-shaking should import factories directly

import { createSignalAPI } from './api';
import { createSignalFactory } from './signal';
import { createComputedFactory, createUntrackFactory } from './computed';
import { createEffectFactory } from './effect';
import { createBatchFactory } from './batch';

// Bundle all core factories
const coreFactories = {
  signal: createSignalFactory,
  computed: createComputedFactory,
  effect: createEffectFactory,
  batch: createBatchFactory,
  untrack: createUntrackFactory,
} as const;

// Create default API lazily
let _defaultAPI: ReturnType<typeof createSignalAPI<typeof coreFactories>> | null = null;

function getDefaultAPI() {
  if (!_defaultAPI) {
    _defaultAPI = createSignalAPI(coreFactories);
  }
  return _defaultAPI;
}

// Export convenience functions that use the shared context
export const signal: ReturnType<typeof createSignalFactory> = (value) => 
  getDefaultAPI().signal(value);
export const computed: ReturnType<typeof createComputedFactory> = (fn) => 
  getDefaultAPI().computed(fn);
export const effect: ReturnType<typeof createEffectFactory> = (fn) => 
  getDefaultAPI().effect(fn);
export const batch: ReturnType<typeof createBatchFactory> = (fn) => 
  getDefaultAPI().batch(fn);
export const untrack: ReturnType<typeof createUntrackFactory> = (fn) => 
  getDefaultAPI().untrack(fn);

// Export the default context for testing
export const activeContext = getDefaultAPI()._ctx;

// Also export the bundle for convenience
export { coreFactories };