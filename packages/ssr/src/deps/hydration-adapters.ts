/**
 * Adapter helpers for async fragment hydration
 *
 * These helpers wrap adapters to add async fragment handling:
 * - withAsyncSupport: Triggers async fragments on attach (for client-side)
 * - withHydrationData: Injects pre-fetched data before attach (for hydration)
 */

import type { Adapter, AdapterConfig } from '@lattice/view/adapter';
import type { NodeRef } from '@lattice/view/types';
import {
  ASYNC_FRAGMENT,
  isAsyncFragment,
  triggerAsyncFragment,
  type AsyncFragment,
} from './async-fragments';

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
 * @example
 * ```ts
 * import { withAsyncSupport } from '@lattice/ssr/client';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 *
 * const adapter = withAsyncSupport(createDOMAdapter());
 * ```
 */
export function withAsyncSupport<TConfig extends AdapterConfig>(
  adapter: Adapter<TConfig>
): Adapter<TConfig> {
  const originalOnAttach = adapter.onAttach;

  return {
    ...adapter,
    onAttach: (ref: NodeRef<TConfig['baseElement']>, parent) => {
      originalOnAttach?.(ref, parent);
      if (isAsyncFragment(ref)) {
        triggerAsyncFragment(ref as AsyncFragment<TConfig['baseElement']>);
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
 * @example
 * ```ts
 * import { withHydrationData, createWindowHydrationStore } from '@lattice/ssr/client';
 * import { createDOMHydrationAdapter } from '@lattice/ssr/client';
 *
 * const store = createWindowHydrationStore();
 * const adapter = withHydrationData(createDOMHydrationAdapter(), store);
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
      if (isAsyncFragment(ref)) {
        const fragment = ref as AsyncFragment<TConfig['baseElement']>;
        const meta = fragment[ASYNC_FRAGMENT];
        if (store.has(meta.id)) {
          meta.setData(store.get(meta.id));
        }
      }
      originalBeforeAttach?.(ref, parent, nextSibling);
    },
  };
}

/**
 * Create a hydration data store from window.__LATTICE_HYDRATION_DATA__
 *
 * @example
 * ```ts
 * import { createWindowHydrationStore, withHydrationData } from '@lattice/ssr/client';
 *
 * const store = createWindowHydrationStore();
 * const adapter = withHydrationData(baseAdapter, store);
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
 *
 * @example
 * ```ts
 * import { clearWindowHydrationData } from '@lattice/ssr/client';
 *
 * // After hydration is complete
 * clearWindowHydrationData();
 * ```
 */
export function clearWindowHydrationData(): void {
  type WindowWithHydration = typeof globalThis & {
    __LATTICE_HYDRATION_DATA__?: Record<string, unknown>;
  };

  delete (globalThis as WindowWithHydration).__LATTICE_HYDRATION_DATA__;
}
