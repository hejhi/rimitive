# @rimitive/view

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

## 0.2.2

### Patch Changes

- 1d03817: New composition APIs, flush strategies for effects/resources, and improved SSR support
- Updated dependencies [1d03817]
  - @rimitive/core@0.3.0

## 0.2.1

### Patch Changes

- Reduce npm package size by excluding source maps and build artifacts
- Updated dependencies
  - @rimitive/core@0.2.1

## 0.2.0

### Minor Changes

- Initial release

### Patch Changes

- Updated dependencies
  - @rimitive/core@0.2.0
