# @rimitive/ssr

## Unreleased

### Minor Changes

- **feat(ssr): add server abstraction layer for streaming SSR**

  New composable server utilities in `@rimitive/ssr/server` that reduce streaming SSR server setup from ~224 lines to ~50 lines of configuration. Inspired by the shadcn copy-paste utility model.

  #### New Features

  - `createStreamingServer()` — High-level streaming SSR handler with automatic service lifecycle, HTML shell generation, and async boundary resolution
  - `createStaticHandler()` — Static file serving with URL pattern matching (exact and prefix patterns) and MIME type detection
  - `createDataPrefetchHandler()` — Data prefetch endpoint for client-side navigation with JSON serialization
  - `createHtmlShell()` — Configurable HTML document shell with stream key injection for async boundary replacement
  - `createServiceFactory()` / `createConfiguredServiceFactory()` — Service lifecycle management with `compose()` integration, per-request isolation, and lifecycle hooks (`onCreate`, `onDispose`, `onError`)
  - `createRequestScope()` — Scoped service creation with automatic disposal
  - `createServerStreamWriter()` — Higher-level stream writer with script tag generation for chunk delivery and bootstrap scripts
  - `handleServiceError()` — Standardized error response handler with customizable error pages
  - `createDevServer()` — Development server wrapper with request logging, pretty error pages, and middleware pipeline
  - `createDevErrorPage()` — Styled HTML error pages with syntax-highlighted stack traces (XSS-safe)
  - `createRequestLogger()` — Color-coded request logging middleware with URL exclusion patterns
  - `installSourceMapSupport()` — Source map support for readable stack traces in development
  - `createLogger()` — Structured logging for 7 streaming SSR lifecycle events (`render-start`, `render-complete`, `chunk-sent`, `stream-complete`, `stream-error`, `service-created`, `service-disposed`) with log level filtering, custom formatters, and request-scoped timing
  - `validateStreamingServerConfig()` / `validateStaticHandlerConfig()` / `validateDataPrefetchHandlerConfig()` / `validateDevServerConfig()` — Configuration validation with `ConfigValidationError` that collects all issues before throwing

  #### No Breaking Changes

  All existing `@rimitive/ssr` and `@rimitive/ssr/server` exports remain unchanged. The new utilities are additive.

  #### Framework Compatibility

  All handlers use standard `node:http` `IncomingMessage`/`ServerResponse` types and work with Node.js native `http.createServer`, Express, Fastify (raw mode), and any framework that exposes Node.js HTTP primitives.

## 0.3.0

### Minor Changes

- @rimitive/signals (minor)
  - Add iter and reconcile primitives for reactive list diffing

  @rimitive/view (minor)
  - Rewrite map() using iter/reconcile for better performance and untrack fix
  - Add shadow DOM support via createShadowModule
  - Improve mount, scope, and match implementations

  @rimitive/ssr (minor)
  - Refactor to use parse5-adapter internally

  @rimitive/mcp (patch) - optional
  - Documentation and test setup updates

  @rimitive/resource (patch) - optional
  - Test setup updates

### Patch Changes

- Updated dependencies
  - @rimitive/signals@0.4.0
  - @rimitive/view@0.3.0
  - @rimitive/resource@0.3.1

## 0.2.2

### Patch Changes

- 1d03817: New composition APIs, flush strategies for effects/resources, and improved SSR support
- Updated dependencies [1d03817]
  - @rimitive/core@0.3.0
  - @rimitive/resource@0.3.0
  - @rimitive/signals@0.3.0
  - @rimitive/view@0.2.2

## 0.2.1

### Patch Changes

- Reduce npm package size by excluding source maps and build artifacts
- Updated dependencies
  - @rimitive/core@0.2.1
  - @rimitive/resource@0.2.1
  - @rimitive/signals@0.2.1
  - @rimitive/view@0.2.1

## 0.2.0

### Minor Changes

- Initial release

### Patch Changes

- Updated dependencies
  - @rimitive/core@0.2.0
  - @rimitive/resource@0.2.0
  - @rimitive/signals@0.2.0
  - @rimitive/view@0.2.0
