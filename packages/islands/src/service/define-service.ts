/**
 * Service Definition
 *
 * Functional approach to defining services with type inference.
 * The extend closure is stored and called later at instantiation time.
 */

// Re-export interface types from shared types file
export type { ServiceDescriptor } from './types';
import type { ServiceDescriptor } from './types';
import type { IslandSSRApi } from '../presets/island-ssr';

/**
 * Define a service with optional extensions
 *
 * Returns the extend closure with type inference. The closure is called
 * later at instantiation time by createSSRHandler or hydrateApp.
 */
export function defineService<TService = IslandSSRApi>(
  extend?: (base: IslandSSRApi) => TService
): ServiceDescriptor<TService> {
  // Default extend function just returns base as-is
  // Cast to accept unknown since server/client base services have compatible shapes
  const extendFn = (base: unknown) => {
    if (extend) {
      return extend(base as IslandSSRApi);
    }
    return base as unknown as TService;
  };

  return {
    extend: extendFn,
  };
}
