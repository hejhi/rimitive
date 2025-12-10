/**
 * Adapter helpers for async fragment hydration
 *
 * withAsyncSupport: Triggers async fragments on attach (for client-side rendering)
 *
 * Note: Hydration data is managed by createLoader() - initial data is passed
 * to the loader on the client, not extracted from markers.
 */

import type { Adapter, AdapterConfig } from '@lattice/view/adapter';
import type { NodeRef } from '@lattice/view/types';
import {
  isAsyncFragment,
  triggerAsyncFragment,
  type AsyncFragment,
} from './async-fragments';

/**
 * Wrap an adapter to trigger async fragments on attach.
 *
 * Use this for client-side rendering (not hydration) where async fragments
 * should immediately start fetching when attached to the DOM.
 *
 * For hydration, data is provided via createLoader(initialData) - the loader
 * seeds async fragments with SSR-resolved data to avoid re-fetching.
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
