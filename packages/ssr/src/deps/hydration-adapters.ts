/**
 * Adapter helpers for async fragment hydration
 *
 * withAsyncSupport: Triggers async fragments on attach (for client-side rendering)
 *
 * Note: Hydration data injection is now handled automatically by the hydration
 * adapter via marker-embedded data (see dom-hydration.ts beforeAttach).
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
 * For hydration, use createDOMHydrationAdapter which automatically extracts
 * and injects data from marker-embedded payloads.
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
