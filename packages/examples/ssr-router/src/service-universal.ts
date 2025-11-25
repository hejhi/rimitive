/**
 * Universal service exports
 *
 * This module provides service exports that work both on client and server.
 * On the client, it uses the client-only service.
 * On the server, exports are not used (server uses createServices factory directly).
 *
 * This module is safe for browser bundling as the client-side export
 * only imports client-safe code.
 */

// Re-export client services for use in components
// These will be bundled in the client build
export { service, mount, router, useSvc, withSvc } from './service-client.js';
export type { Service, Signals, DOMViews } from './service-client.js';
