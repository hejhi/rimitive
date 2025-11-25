/**
 * Service Configuration (Client-safe)
 *
 * Re-exports client-side service factories from the islands package.
 * For server-side, import createIslandSSRApi directly from '@lattice/islands/presets/island-ssr'.
 *
 * For custom extensions, wrap the factory:
 *
 * const createMyService = (signals) => {
 *   const base = createIslandClientApi(signals);
 *   return { ...base, svc: { ...base.svc, analytics: createAnalytics() } };
 * };
 */
export { createIslandClientApi } from '@lattice/islands/presets/island-client';
export { island } from '@lattice/islands/island';

// NOTE: Do NOT re-export createIslandSSRApi here - it pulls in server-only code
// (dom-server.js -> ssr-context.js with AsyncLocalStorage)
// Server code should import directly from '@lattice/islands/presets/island-ssr'

/**
 * Re-export service types for convenience
 */
export type { IslandClientSvc as Service } from '@lattice/islands/presets/island-client';

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
