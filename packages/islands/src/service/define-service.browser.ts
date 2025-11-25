/**
 * Service Definition - Browser Version
 *
 * Browser-safe version that doesn't import server-only dependencies.
 * The actual service creation happens in hydrateApp with the DOM renderer.
 */

// Re-export interface types from shared types file
export type { ServiceDescriptor } from './types';
import { IslandSSRApi } from 'src/presets/island-ssr';
import type { ServiceDescriptor } from './types';

/**
 * createBaseService is not available in browser
 * Service creation happens inside hydrateApp
 */
export function createBaseService(): IslandSSRApi {
  throw new Error('createBaseService should not be called in browser');
}

/**
 * Define a service with optional extensions
 *
 * Same as server version - just stores the extend function for later use.
 */
export function defineService<TService = IslandSSRApi>(
  extend?: (base: IslandSSRApi) => TService
): ServiceDescriptor<TService> {
  // Cast to accept unknown since server/client base services have compatible shapes
  const extendFn = (base: unknown) => {
    if (extend) return extend(base as IslandSSRApi);
    return base as unknown as TService;
  };

  return {
    extend: extendFn,
  };
}
