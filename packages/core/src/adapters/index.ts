/**
 * Lattice Core Adapters
 * 
 * This module exports the state adapter interfaces and implementations
 * available in the core package.
 */

// Re-export core adapter interfaces
export type { 
  StateStore, 
  StateAdapter, 
  StateAdapterWithMiddleware, 
  StateAdapterFactory 
} from '../shared/state-adapter';

export { 
  isStateAdapter, 
  isStateStore 
} from '../shared/state-adapter';

// Re-export Zustand adapter
export type {
  ZustandStore,
  ZustandStoreCreator,
  ZustandMiddleware,
  ZustandAdapterConfig
} from './zustand';

export {
  ZustandStateAdapter,
  createZustandAdapter,
  createZustandAdapterWithImmer,
  createZustandAdapterSync
} from './zustand';