/**
 * Data Prefetch - Client-side navigation prefetching
 *
 * Wires up data prefetching for client-side navigation.
 * When the user navigates, data is fetched in parallel with lazy chunk loading.
 * Copy this into your project and customize the endpoint.
 */
import type { Readable } from '@rimitive/signals';

type PrefetchDeps = {
  effect: (fn: () => void) => () => void;
  router: { currentPath: Readable<string>; isInitial: Readable<boolean> };
  loader: { setData: (id: string, value: unknown) => void };
};

/**
 * Wire up data prefetching for client-side navigation.
 * Reacts to path changes and feeds prefetched data into the loader.
 *
 * @param svc - Service with effect, router, and loader
 * @param endpoint - The data endpoint prefix (default: '/_data')
 */
export const prefetch =
  ({ effect, router, loader }: PrefetchDeps) =>
  (endpoint = '/_data'): (() => void) => {
    return effect(() => {
      if (router.isInitial()) return;
      fetch(endpoint + router.currentPath())
        .then((res) => res.json())
        .then((data: Record<string, unknown>) => {
          for (const [id, value] of Object.entries(data)) {
            loader.setData(id, value);
          }
        })
        .catch((err: unknown) => {
          console.warn('[prefetch] Failed to prefetch data:', err);
        });
    });
  };
