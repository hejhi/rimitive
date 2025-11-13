/**
 * Data Registry - manages fetched data for server-side rendering and hydration
 *
 * Server: Stores fetched data and serializes it for client
 * Client: Hydrates from serialized data and provides cached values
 */

import type { SerializedData } from './types';

class DataRegistry {
  private data = new Map<string, unknown>();
  private promises = new Map<string, Promise<unknown>>();

  /**
   * Register a data fetcher
   * On server: executes the fetcher and caches the result
   * On client: returns previously hydrated data without executing fetcher
   */
  async register<TData>(key: string, fetcher: () => Promise<TData>): Promise<TData> {
    // Check if data already exists (hydrated or previously fetched)
    if (this.data.has(key)) {
      return this.data.get(key) as TData;
    }

    // Check if fetch is already in progress
    if (this.promises.has(key)) {
      return this.promises.get(key) as Promise<TData>;
    }

    // Start new fetch
    const promise = fetcher();
    this.promises.set(key, promise);

    try {
      const result = await promise;
      this.data.set(key, result);
      this.promises.delete(key);
      return result;
    } catch (error) {
      this.promises.delete(key);
      throw error;
    }
  }

  /**
   * Get data by key (synchronous)
   * Used after data has been fetched or hydrated
   */
  get<TData>(key: string): TData | undefined {
    return this.data.get(key) as TData | undefined;
  }

  /**
   * Set data directly (used during hydration)
   */
  set<TData>(key: string, value: TData): void {
    this.data.set(key, value);
  }

  /**
   * Check if data exists
   */
  has(key: string): boolean {
    return this.data.has(key);
  }

  /**
   * Serialize all data to JSON (server-side)
   */
  serialize(): string {
    const obj: SerializedData = {};
    for (const [key, value] of this.data.entries()) {
      obj[key] = value;
    }
    return JSON.stringify(obj);
  }

  /**
   * Hydrate from serialized JSON (client-side)
   */
  hydrate(json: string): void {
    try {
      const parsed = JSON.parse(json) as SerializedData;
      for (const [key, value] of Object.entries(parsed)) {
        this.data.set(key, value);
      }
    } catch (error) {
      console.error('Failed to hydrate data registry:', error);
    }
  }

  /**
   * Clear all data (mainly for testing)
   */
  clear(): void {
    this.data.clear();
    this.promises.clear();
  }
}

// Global singleton registry
let registry: DataRegistry | null = null;

/**
 * Get the global data registry instance
 */
export function getRegistry(): DataRegistry {
  if (!registry) {
    registry = new DataRegistry();
  }
  return registry;
}

/**
 * Initialize registry with hydrated data (client-side)
 */
export function initializeRegistry(json: string): void {
  getRegistry().hydrate(json);
}

/**
 * Clear the global registry (mainly for testing)
 */
export function clearRegistry(): void {
  getRegistry().clear();
}
