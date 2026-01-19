import { defineModule } from '@rimitive/core';
import { EffectModule, type EffectFactory } from '@rimitive/signals/effect';
import { SignalModule, type SignalFactory } from '@rimitive/signals/signal';
import {
  ComputedModule,
  type ComputedFactory,
} from '@rimitive/signals/computed';
import type {
  Resource,
  ResourceState,
  Fetcher,
  ResourceFactory,
} from './types';

/**
 * Dependencies required by the Resource module.
 */
export type ResourceDeps = {
  signal: SignalFactory;
  computed: ComputedFactory;
  effect: EffectFactory;
};

/**
 * Check if an error is an AbortError (from AbortController.abort())
 */
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Create a resource factory function.
 *
 * Resources provide reactive async data fetching with automatic dependency tracking.
 * When reactive dependencies inside the fetcher change, the resource automatically
 * re-fetches and aborts any in-flight request.
 *
 * @example Basic usage
 * ```ts
 * const { resource } = createResource({ signal, computed, effect });
 *
 * const products = resource((signal) =>
 *   fetch('/api/products', { signal }).then(r => r.json())
 * );
 *
 * // Read state
 * products(); // { status: 'pending' } | { status: 'ready', value: [...] } | { status: 'error', error: ... }
 *
 * // Convenience accessors
 * products.loading(); // true | false
 * products.data();    // T | undefined
 * products.error();   // unknown | undefined
 * ```
 *
 * @example With reactive dependencies and abort support
 * ```ts
 * const categoryId = signal(1);
 *
 * const products = resource((signal) =>
 *   fetch(`/api/products?category=${categoryId()}`, { signal }).then(r => r.json())
 * );
 *
 * // When categoryId changes, products automatically refetches
 * // and aborts any in-flight request
 * categoryId(2); // triggers new fetch, aborts previous
 * ```
 *
 * @example With scope cleanup
 * ```ts
 * const ProductList = (svc) => {
 *   const { el, resource, onCleanup } = svc;
 *
 *   const products = resource((signal) =>
 *     fetch('/api/products', { signal }).then(r => r.json())
 *   );
 *
 *   // Abort in-flight request when element is removed
 *   onCleanup(products.dispose);
 *
 *   return el('ul')(/* ... *\/);
 * };
 * ```
 */
export function createResourceFactory(deps: ResourceDeps): ResourceFactory {
  const { signal, computed, effect } = deps;

  return function resource<T>(fetcher: Fetcher<T>): Resource<T> {
    // Core state signal
    const state = signal<ResourceState<T>>({ status: 'pending' });

    // Current AbortController for in-flight request
    let controller: AbortController | undefined;

    // Version counter to handle race conditions
    // When deps change mid-flight, we ignore stale responses
    let fetchVersion = 0;

    // Abort any in-flight request
    const abortCurrent = (): void => {
      if (controller) {
        controller.abort();
        controller = undefined;
      }
    };

    // The refetch function - can be called manually or by effect
    const doFetch = (): void => {
      // Abort previous request
      abortCurrent();

      const version = ++fetchVersion;

      // Create new controller for this fetch
      controller = new AbortController();
      const abortSignal = controller.signal;

      // Set pending state synchronously
      state({ status: 'pending' });

      // Execute fetcher - this is where reactive deps are tracked
      // The promise creation is sync, only resolution is async
      let promise: Promise<T>;
      try {
        promise = fetcher(abortSignal);
      } catch (err) {
        // Sync error in fetcher (not in promise)
        // Don't report abort errors as they're expected
        if (!isAbortError(err)) {
          state({ status: 'error', error: err });
        }
        return;
      }

      // Handle async resolution
      promise.then(
        (value) => {
          // Only update if this is still the current fetch
          if (version === fetchVersion) {
            state({ status: 'ready', value });
          }
        },
        (error: unknown) => {
          // Only update if this is still the current fetch
          if (version === fetchVersion) {
            // Don't report abort errors - they're expected when deps change or dispose is called
            if (!isAbortError(error)) {
              state({ status: 'error', error });
            }
          }
        }
      );
    };

    // Effect tracks reactive deps in fetcher and re-runs on change
    // The effect runs synchronously on creation, triggering first fetch
    const disposeEffect = effect(() => {
      doFetch();
    });

    // Dispose function - aborts in-flight request and stops tracking
    const dispose = (): void => {
      abortCurrent();
      disposeEffect();
    };

    // Convenience computed accessors
    const loading = computed(() => state().status === 'pending');

    const data = computed(() => {
      const s = state();
      return s.status === 'ready' ? s.value : undefined;
    });

    const error = computed(() => {
      const s = state();
      return s.status === 'error' ? s.error : undefined;
    });

    // Build resource object using Object.assign to satisfy readonly properties
    const resourceFn = Object.assign(() => state(), {
      loading,
      data,
      error,
      refetch: doFetch,
      dispose,
    }) as Resource<T>;

    return resourceFn;
  };
}

/**
 * Resource module - provides reactive async data fetching.
 * Depends on Signal, Computed, and Effect modules.
 */
export const ResourceModule = defineModule({
  name: 'resource',
  dependencies: [SignalModule, ComputedModule, EffectModule],
  create: ({ signal, computed, effect }): ResourceFactory =>
    createResourceFactory({ signal, computed, effect }),
});
