/**
 * Data Cache - IndexedDB storage for route data
 *
 * Provides a cache(route, fetcher, render) primitive for local-first apps.
 * Data is always available (no loading states) - cached or freshly fetched.
 */

import { defineConfigurableModule } from '@rimitive/core';

/**
 * Cache primitive function type.
 * Like load() but for local-first - data is always available, no loading states.
 */
export type CacheFn = <TData, TResult>(
  route: string,
  fetcher: () => Promise<TData>,
  render: (data: TData) => TResult
) => Promise<TResult>;

export type DataCache = {
  /**
   * The cache primitive - fetch (if needed) and render.
   * Like load() but for local-first apps where data is always available.
   */
  <TData, TResult>(
    route: string,
    fetcher: () => Promise<TData>,
    render: (data: TData) => TResult
  ): Promise<TResult>;

  /**
   * Create a cached fetcher for a route.
   * Returns a thunk that can be called later.
   */
  fetch: <TData>(
    route: string,
    fetcher: () => Promise<TData>
  ) => () => Promise<TData>;

  /** Get cached data for a route (if exists) */
  get: <TData>(route: string) => Promise<TData | null>;

  /** Set cached data for a route */
  set: <TData>(route: string, data: TData) => Promise<void>;

  /** Delete cached data for a route */
  delete: (route: string) => Promise<void>;

  /** Clear all cached data */
  clear: () => Promise<void>;

  /** Invalidate a route (delete and return fetcher for re-fetch) */
  invalidate: <TData>(
    route: string,
    fetcher: () => Promise<TData>
  ) => () => Promise<TData>;
};

export type DataCacheConfig = {
  /** IndexedDB database name */
  dbName: string;
  /** IndexedDB store name */
  storeName?: string;
};

type CachedEntry<TData = unknown> = {
  route: string;
  data: TData;
  timestamp: number;
};

function createIndexedDBStore(dbName: string, storeName: string) {
  let dbPromise: Promise<IDBDatabase> | null = null;

  function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'route' });
        }
      };
    });

    return dbPromise;
  }

  return {
    async get<TData>(route: string): Promise<TData | null> {
      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const request = store.get(route);

          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const entry = request.result as CachedEntry<TData> | undefined;
            resolve(entry?.data ?? null);
          };
        });
      } catch {
        return null;
      }
    },

    async set<TData>(route: string, data: TData): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const entry: CachedEntry<TData> = {
          route,
          data,
          timestamp: Date.now(),
        };
        const request = store.put(entry);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    },

    async delete(route: string): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(route);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    },

    async clear(): Promise<void> {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    },
  };
}

export function createDataCache(config: DataCacheConfig): DataCache {
  const { dbName, storeName = 'data' } = config;
  const store = createIndexedDBStore(dbName, storeName);

  // Helper to get or fetch data
  async function getOrFetch<TData>(
    route: string,
    fetcher: () => Promise<TData>
  ): Promise<TData> {
    const cached = await store.get<TData>(route);
    if (cached !== null) {
      return cached;
    }
    const data = await fetcher();
    await store.set(route, data);
    return data;
  }

  // The cache primitive - callable function
  const cache = async function <TData, TResult>(
    route: string,
    fetcher: () => Promise<TData>,
    render: (data: TData) => TResult
  ): Promise<TResult> {
    const data = await getOrFetch(route, fetcher);
    return render(data);
  } as DataCache;

  // Additional methods
  cache.fetch = <TData>(route: string, fetcher: () => Promise<TData>) => {
    return () => getOrFetch(route, fetcher);
  };

  cache.get = <TData>(route: string) => store.get<TData>(route);
  cache.set = <TData>(route: string, data: TData) => store.set(route, data);
  cache.delete = (route: string) => store.delete(route);
  cache.clear = () => store.clear();

  cache.invalidate = <TData>(route: string, fetcher: () => Promise<TData>) => {
    return async (): Promise<TData> => {
      await store.delete(route);
      const data = await fetcher();
      await store.set(route, data);
      return data;
    };
  };

  return cache;
}

/**
 * Data cache module for composition.
 *
 * Provides a `cache(route, fetcher, render)` primitive for local-first apps.
 * Like `load()` but data is always available - no loading states needed.
 */
export const DataCacheModule = defineConfigurableModule({
  name: 'cache' as const,
  dependencies: [],
  create: (_deps: object, config: DataCacheConfig): DataCache =>
    createDataCache(config),
});
