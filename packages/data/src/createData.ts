/**
 * createData - HOC factory for data islands
 *
 * Creates a higher-order component that injects fetched data into components.
 * Data is fetched on the server and rehydrated on the client.
 */

import { getRegistry } from './registry';
import type { DataFetcher, DataIslandHOC } from './types';

/**
 * Create a data island HOC
 *
 * @param key - Unique identifier for this data island
 * @param fetcher - Async function that returns the data
 * @returns HOC that injects data and refetch function into component factory
 *
 * @example
 * ```ts
 * const withUserData = createData('user', async () => {
 *   return await fetchUser();
 * });
 *
 * const Profile = withUserData((user, get) =>
 *   create(({ el }) => () => {
 *     return el('div')(
 *       el('h1')(user.name)()
 *     )();
 *   })
 * );
 * ```
 */
export function createData<TData>(
  key: string,
  fetcher: DataFetcher<TData>
): DataIslandHOC<TData> {
  // Return HOC that injects data into component factory
  return <TComponent extends (...args: any[]) => any>(
    factory: (data: TData, get: () => Promise<TData>) => TComponent
  ): TComponent => {
    // Wait for data to be available
    // This is synchronous on client (data already hydrated)
    // On server, this must be awaited before rendering
    const data = getRegistry().get<TData>(key);

    if (!data) {
      // This shouldn't happen if used correctly
      // Data should either be fetched (server) or hydrated (client) before component creation
      throw new Error(
        `Data island "${key}" not ready. ` +
        `Ensure data is fetched on server or hydrated on client before rendering.`
      );
    }

    // Create refetch function
    const get = async (): Promise<TData> => {
      // Check if we're on server
      if (typeof window === 'undefined') {
        // Server: return the same data (no refetch needed)
        return data;
      }

      // Client: actually refetch (no caching)
      const fresh = await fetcher();
      getRegistry().set(key, fresh);
      return fresh;
    };

    // Create component with injected data and get function
    const component = factory(data, get);

    // Return component as-is
    // Runtime args will be passed through when component is called
    return component;
  };
}
