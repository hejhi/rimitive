/**
 * Data Prefetch - Client-side navigation prefetching
 *
 * Wires up data prefetching for client-side navigation.
 * When the user navigates, data is fetched in parallel with lazy chunk loading.
 * Copy this into your project and customize the endpoint.
 */

type LoaderLike = {
  setData: (id: string, value: unknown) => void;
};

/**
 * Create a prefetch handler for client-side navigation.
 * Returns a function suitable for the `onNavigate` option in service creation.
 *
 * @param loader - The loader service (with setData method)
 * @param endpoint - The data endpoint prefix (default: '/_data')
 */
export function createPrefetch(
  loader: LoaderLike,
  endpoint = '/_data'
): (path: string) => void {
  return (path: string) => {
    fetch(endpoint + path)
      .then((res) => res.json())
      .then((data: Record<string, unknown>) => {
        for (const [id, value] of Object.entries(data)) {
          loader.setData(id, value);
        }
      })
      .catch((err: unknown) => {
        console.warn('[prefetch] Failed to prefetch data:', err);
      });
  };
}
