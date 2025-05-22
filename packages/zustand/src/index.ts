/**
 * Production-Quality Zustand State Adapter for Lattice Components
 * 
 * This adapter provides full type safety and integrates the complete Zustand ecosystem
 * including middleware, devtools, and performance optimizations with zero compromises.
 */

import type { StateAdapter, StateStore, StateAdapterWithMiddleware } from '@lattice/core/shared/state-adapter';
import type { SetState, GetState } from '@lattice/core/shared/types';

/**
 * Type-safe Zustand store interface
 */
export interface ZustandStore<T> {
  getState: () => T;
  setState: (
    partial: T | Partial<T> | ((state: T) => T | Partial<T>),
    replace?: boolean | undefined
  ) => void;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
  destroy: () => void;
}

/**
 * Type-safe Zustand middleware interface
 */
export type ZustandMiddleware<T> = (
  config: (set: SetState<T>, get: GetState<T>) => T
) => (set: SetState<T>, get: GetState<T>) => T;

/**
 * Type-safe Zustand store creator
 */
export interface ZustandStoreCreator {
  <T>(
    createState: (set: SetState<T>, get: GetState<T>) => T
  ): ZustandStore<T>;
}

/**
 * Configuration options for the Zustand adapter
 */
export interface ZustandAdapterConfig {
  /**
   * Enable Redux DevTools integration
   */
  devtools?: boolean;
  
  /**
   * Name for the store in DevTools
   */
  name?: string;
  
  /**
   * Store creator function (for dependency injection)
   */
  storeCreator?: ZustandStoreCreator;
}

/**
 * Type-safe Zustand-backed state store implementation
 */
class ZustandStateStore<T> implements StateStore<T> {
  private zustandStore: ZustandStore<T>;

  constructor(zustandStore: ZustandStore<T>) {
    this.zustandStore = zustandStore;
  }

  get: GetState<T> = () => {
    return this.zustandStore.getState();
  };

  set: SetState<T> = (partial, replace = false) => {
    this.zustandStore.setState(partial, replace);
  };

  subscribe = (listener: (state: T) => void): (() => void) => {
    return this.zustandStore.subscribe((state) => {
      listener(state);
    });
  };

  destroy = (): void => {
    this.zustandStore.destroy();
  };
}

/**
 * Production-quality Zustand State Adapter
 * 
 * Provides full type safety and ecosystem integration
 */
export class ZustandStateAdapter<T> implements StateAdapterWithMiddleware<T, ZustandMiddleware<T>> {
  private config: ZustandAdapterConfig;
  private storeCreator: ZustandStoreCreator;

  constructor(config: ZustandAdapterConfig) {
    this.config = config;
    
    if (!config.storeCreator) {
      throw new Error(
        'ZustandStateAdapter requires a storeCreator. Use createZustandAdapter() factory function instead.'
      );
    }
    
    this.storeCreator = config.storeCreator;
  }

  createStore(initialState: T): StateStore<T> {
    const zustandStore = this.storeCreator<T>((set, get) => {
      // Handle both direct state and factory functions
      if (typeof initialState === 'function') {
        // Type-safe factory function call
        const stateFactory = initialState as (params: { set: SetState<T>; get: GetState<T> }) => T;
        return stateFactory({ set, get });
      }
      
      return initialState;
    });

    return new ZustandStateStore(zustandStore);
  }

  createStoreWithMiddleware(
    initialState: T, 
    middleware: ZustandMiddleware<T>[]
  ): StateStore<T> {
    // Apply middleware to the state creator function
    const baseStateCreator = (set: SetState<T>, get: GetState<T>) => {
      if (typeof initialState === 'function') {
        const stateFactory = initialState as (params: { set: SetState<T>; get: GetState<T> }) => T;
        return stateFactory({ set, get });
      }
      return initialState;
    };

    // Apply middleware chain
    const enhancedStateCreator = middleware.reduce(
      (creator, middleware) => middleware(creator),
      baseStateCreator
    );

    const zustandStore = this.storeCreator<T>(enhancedStateCreator);
    return new ZustandStateStore(zustandStore);
  }
}

/**
 * Factory function for creating Zustand state adapters
 * This handles the async import and provides a clean API
 */
export async function createZustandAdapter<T>(
  config: Omit<ZustandAdapterConfig, 'storeCreator'> = {}
): Promise<StateAdapter<T>> {
  try {
    // Dynamic import for Zustand
    const zustand = await import('zustand');
    const create = zustand.create || zustand.default?.create;
    
    if (!create) {
      throw new Error('Could not find Zustand create function');
    }
    
    let storeCreator: ZustandStoreCreator = create;
    
    // Handle devtools middleware if enabled
    if (config.devtools) {
      try {
        const devtoolsModule = await import('zustand/middleware');
        const devtools = devtoolsModule.devtools;
        
        if (devtools) {
          storeCreator = <T>(createFn: (set: SetState<T>, get: GetState<T>) => T) =>
            create(devtools(createFn, { name: config.name || 'Lattice Component' }));
        }
      } catch (error) {
        console.warn('Zustand devtools middleware not available, continuing without devtools');
      }
    }
    
    return new ZustandStateAdapter<T>({
      ...config,
      storeCreator,
    });
  } catch (error) {
    throw new Error(
      `Failed to create Zustand adapter: ${error}. Please ensure zustand is installed: npm install zustand`
    );
  }
}

/**
 * Factory function for creating Zustand adapters with Immer middleware
 */
export async function createZustandAdapterWithImmer<T>(
  config: Omit<ZustandAdapterConfig, 'storeCreator'> = {}
): Promise<StateAdapter<T>> {
  try {
    const zustand = await import('zustand');
    const create = zustand.create || zustand.default?.create;
    
    if (!create) {
      throw new Error('Could not find Zustand create function');
    }
    
    const immerModule = await import('zustand/middleware/immer');
    const immer = immerModule.immer;
    
    if (!immer) {
      throw new Error('Could not find Zustand immer middleware');
    }
    
    let storeCreator: ZustandStoreCreator = <T>(createFn: (set: SetState<T>, get: GetState<T>) => T) =>
      create(immer(createFn));
    
    // Handle devtools middleware if enabled
    if (config.devtools) {
      try {
        const devtoolsModule = await import('zustand/middleware');
        const devtools = devtoolsModule.devtools;
        
        if (devtools) {
          storeCreator = <T>(createFn: (set: SetState<T>, get: GetState<T>) => T) =>
            create(devtools(immer(createFn), { name: config.name || 'Lattice Component' }));
        }
      } catch (error) {
        console.warn('Zustand devtools middleware not available, continuing without devtools');
      }
    }
    
    return new ZustandStateAdapter<T>({
      ...config,
      storeCreator,
    });
  } catch (error) {
    throw new Error(
      `Failed to create Zustand adapter with Immer: ${error}. Please ensure zustand and immer are installed: npm install zustand immer`
    );
  }
}

/**
 * Synchronous factory for testing and controlled environments
 * Requires pre-injected Zustand dependencies
 */
export function createZustandAdapterSync<T>(
  storeCreator: ZustandStoreCreator,
  config: Omit<ZustandAdapterConfig, 'storeCreator'> = {}
): StateAdapter<T> {
  return new ZustandStateAdapter<T>({
    ...config,
    storeCreator,
  });
}