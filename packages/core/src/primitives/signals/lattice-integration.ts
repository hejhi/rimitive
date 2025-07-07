// Production integration of signals with Lattice
// Simply re-exports the signals API for component use

import { 
  signal,
  computed,
  effect,
  batch,
  subscribe,
  set
} from '@lattice/signals';

// Create the signal factory for Lattice context
export function createSignalFactory() {
  return {
    signal,
    computed,
    batch,
    effect,
    subscribe,
    set,
  };
}