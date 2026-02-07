/**
 * @rimitive/ssr - Server-Side Rendering for Rimitive
 *
 * Provides SSR rendering and hydration for Rimitive applications.
 *
 * ## Import Guide
 *
 * | Use Case | Import |
 * |----------|--------|
 * | Server rendering | `import { renderToString, renderToStream, ... } from '@rimitive/ssr/server'` |
 * | Server abstractions | `import { createStreamingServer, createStaticHandler, ... } from '@rimitive/ssr/server'` |
 * | Service factory | `import { createServiceFactory, createRequestScope, ... } from '@rimitive/ssr/server'` |
 * | HTML shell | `import { createHtmlShell } from '@rimitive/ssr/server'` |
 * | Client hydration | `import { createClientAdapter, connectStream, ... } from '@rimitive/ssr/client'` |
 */

export { HydrationMismatch } from './client/adapter';
