/**
 * Service Definition - Browser Version
 *
 * Browser-safe version that doesn't import server-only dependencies.
 * The actual service creation happens in hydrateApp with the DOM renderer.
 */

// Re-export interface types from shared types file
export type { ServiceDescriptor } from './types';
import type { IslandClientApi } from '../presets/island-client';
import type { ServiceDescriptor } from './types';

/**
 * createBaseService is not available in browser
 * Service creation happens inside hydrateApp
 */
export function createBaseService(): IslandClientApi {
  throw new Error('createBaseService should not be called in browser');
}

/**
 * Define a service with optional extensions
 *
 * Same as server version - just stores the extend function for later use.
 */
export function defineService<TService = IslandClientApi>(
  extend?: (base: IslandClientApi) => TService
): ServiceDescriptor<TService> {
  // Cast to accept unknown since server/client base services have compatible shapes
  const extendFn = (base: unknown) => {
    if (extend) return extend(base as IslandClientApi);
    return base as unknown as TService;
  };

  return {
    extend: extendFn,
  };
}
