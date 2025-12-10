/**
 * Adapter helpers for async fragment support
 *
 * These helpers wrap adapters to add async fragment handling:
 * - withAsyncSupport: Triggers async fragments on attach (for client-side)
 * - withHydrationData: Injects pre-fetched data before attach (for hydration)
 */

import type { Adapter, AdapterConfig } from '@lattice/view/adapter';
import type { NodeRef } from '@lattice/view/types';
import { isAsyncFragment, triggerAsyncFragment } from './load';
import type { AsyncFragmentRef } from './load';

/**
 * Hydration data store interface
 */
export type HydrationDataStore = {
  get: (id: string) => unknown | undefined;
  has: (id: string) => boolean;
};

/**
 * Wrap an adapter to trigger async fragments on attach.
 *
 * Use this for client-side rendering where async fragments should
 * immediately start fetching when attached to the DOM.
 *
 * @param adapter - The base adapter to wrap
 * @returns Wrapped adapter that triggers async fragments
 *
 * @example
 * ```ts
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 * import { withAsyncSupport } from '@lattice/resource';
 *
 * const adapter = withAsyncSupport(createDOMAdapter());
 * // Async fragments will auto-fetch when attached
 * ```
 */
export function withAsyncSupport<TConfig extends AdapterConfig>(
  adapter: Adapter<TConfig>
): Adapter<TConfig> {
  const originalOnAttach = adapter.onAttach;

  return {
    ...adapter,
    onAttach: (ref: NodeRef<TConfig['baseElement']>, parent) => {
      // Call original hook first
      originalOnAttach?.(ref, parent);

      // Trigger async fragments
      if (isAsyncFragment(ref)) {
        triggerAsyncFragment(ref as AsyncFragmentRef<TConfig['baseElement']>);
      }
    },
  };
}

/**
 * Wrap an adapter to inject hydration data into async fragments before attach.
 *
 * Use this for client-side hydration where SSR-fetched data should be
 * injected into fragments to prevent re-fetching.
 *
 * @param adapter - The base adapter to wrap
 * @param store - Hydration data store (typically backed by window.__LATTICE_HYDRATION_DATA__)
 * @returns Wrapped adapter that injects hydration data
 *
 * @example
 * ```ts
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 * import { withHydrationData } from '@lattice/resource';
 *
 * const hydrationStore = {
 *   get: (id) => window.__LATTICE_HYDRATION_DATA__?.[id],
 *   has: (id) => id in (window.__LATTICE_HYDRATION_DATA__ ?? {}),
 * };
 *
 * const adapter = withHydrationData(createDOMAdapter(), hydrationStore);
 * // Async fragments will use hydration data instead of fetching
 * ```
 */
export function withHydrationData<TConfig extends AdapterConfig>(
  adapter: Adapter<TConfig>,
  store: HydrationDataStore
): Adapter<TConfig> {
  const originalBeforeAttach = adapter.beforeAttach;

  return {
    ...adapter,
    beforeAttach: (ref, parent, nextSibling) => {
      // Inject hydration data before attach
      if (isAsyncFragment(ref)) {
        const fragment = ref as AsyncFragmentRef<TConfig['baseElement']>;
        if (store.has(fragment.__id)) {
          fragment.__data = store.get(fragment.__id);
          fragment.__resolved = true;
        }
      }

      // Call original hook
      originalBeforeAttach?.(ref, parent, nextSibling);
    },
  };
}

/**
 * Create a hydration data store from window.__LATTICE_HYDRATION_DATA__
 *
 * @returns HydrationDataStore backed by window global, or empty store if not available
 *
 * @example
 * ```ts
 * import { createWindowHydrationStore, withHydrationData } from '@lattice/resource';
 *
 * const store = createWindowHydrationStore();
 * const adapter = withHydrationData(createDOMAdapter(), store);
 * ```
 */
export function createWindowHydrationStore(): HydrationDataStore {
  type WindowWithHydration = typeof globalThis & {
    __LATTICE_HYDRATION_DATA__?: Record<string, unknown>;
  };

  const getStore = () =>
    (globalThis as WindowWithHydration).__LATTICE_HYDRATION_DATA__;

  return {
    get: (id) => getStore()?.[id],
    has: (id) => {
      const data = getStore();
      return data !== undefined && id in data;
    },
  };
}

/**
 * Clear hydration data from window after hydration is complete.
 * Call this after the initial render to free memory.
 */
export function clearWindowHydrationData(): void {
  type WindowWithHydration = typeof globalThis & {
    __LATTICE_HYDRATION_DATA__?: Record<string, unknown>;
  };

  delete (globalThis as WindowWithHydration).__LATTICE_HYDRATION_DATA__;
}
