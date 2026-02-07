/**
 * Streaming SSR Utilities
 *
 * Copy-able utilities for building streaming SSR apps with Rimitive.
 * These are patterns, not a framework — copy into your project and modify as needed.
 *
 * - streaming.ts: Load boundary rendering helpers
 * - prefetch.ts: Client-side navigation data prefetch
 */
export { renderBoundary, type BoundaryConfig } from './streaming.js';
export { prefetch } from './prefetch.js';
