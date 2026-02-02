# @rimitive/mcp

## 0.1.2

### Patch Changes

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

## 0.1.1

### Patch Changes

- 34665ff: Improve documentation discoverability with SearchTags
  - Add SearchTags MDX component for invisible metadata tagging
  - Tag all guides and pattern docs with relevant keywords
  - Parser now extracts @tags from HTML comments for search ranking
  - Better search results for common queries like "toggle", "dropdown", "context"
