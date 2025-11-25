/**
 * Service Definition
 *
 * Defines the service configuration using the functional defineService pattern.
 * The service closure is stored and called later at instantiation time:
 * - Server: per-request by createSSRHandler
 * - Client: once by hydrateApp
 */
import { defineService, createIsland } from '@lattice/islands/service';

/**
 * Define service - no extensions needed for this example
 * For custom extensions, pass a closure:
 *
 * export const service = defineService((base) => ({
 *   ...base,
 *   analytics: createAnalytics(),
 * }));
 */
export const service = defineService();

/**
 * Typed island factory for creating islands with full type inference
 */
export const island = createIsland(service);

/**
 * Re-export service type for convenience
 */
export type { FullBaseService as Service } from '@lattice/islands/service';

/**
 * TEMPORARY: Re-export router/useSvc from old service-client for page components
 * These will be replaced by typedConnect in Phase 2
 */
export { router, useSvc, withSvc } from './service-client.js';

/**
 * Re-export singleton's signals for hydrateApp
 * This ensures islands share the same reactive system as the router
 */
export { service as clientService } from './service-client.js';
