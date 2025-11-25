/**
 * Service Configuration (Client-safe)
 *
 * Re-exports island primitive and client-side service utilities.
 * Services are composed manually using signals/view/islands primitives.
 */
export { island } from '@lattice/islands/island';

/**
 * Re-export service types from the client singleton
 */
export type { MergedService as Service } from './service-client.js';

/**
 * Re-export router/useSvc from service-client for page components
 */
export { router, useSvc, withSvc, createClientApi } from './service-client.js';

/**
 * Re-export singleton service for client hydration
 * This ensures islands share the same reactive system as the router
 */
export { service as clientService } from './service-client.js';
