/**
 * Edge SSR Utilities
 *
 * Copy-able utilities for building edge-rendered apps with Rimitive.
 * These are patterns, not a framework - copy into your project and modify as needed.
 *
 * ## Server (Worker)
 *
 * - **html.ts**: HTML document template utilities
 * - **response.ts**: Response helpers for basic and streaming SSR
 *
 * ```ts
 * import { renderToResponse, renderToStreamingResponse } from './edge';
 *
 * // Basic SSR
 * return renderToResponse('/about', {
 *   title: 'About',
 *   createService,
 *   createApp: (svc) => App(svc),
 * });
 *
 * // Streaming SSR
 * return renderToStreamingResponse('/dashboard', {
 *   title: 'Dashboard',
 *   streamKey: '__APP_STREAM__',
 *   createService,
 *   createApp: (svc) => App(svc),
 * });
 * ```
 *
 * ## Client
 *
 * - **hydrate.ts**: Client-side hydration utilities
 *
 * ```ts
 * import { hydrateApp } from './edge';
 *
 * hydrateApp({
 *   rootSelector: '.container',
 *   streamKey: '__APP_STREAM__',
 *   createService,
 *   createApp: (svc) => App(svc),
 * });
 * ```
 */

// HTML template utilities
export {
  createHtmlTemplate,
  escapeHtml,
  type HtmlTemplate,
  type HtmlTemplateOptions,
} from './html.js';

// Response utilities (server/worker)
export {
  renderToResponse,
  renderToStreamingResponse,
  type RenderOptions,
} from './response.js';

// Hydration utilities (client)
export {
  hydrateApp,
  needsHydration,
  type HydrateOptions,
  type HydrateResult,
} from './hydrate.js';
