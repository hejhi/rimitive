/**
 * @lattice/view - Declarative view primitives for Lattice
 *
 * ## Quick Start
 * ```typescript
 * import { createDOMView } from '@lattice/view';
 *
 * const { el, map, match, signal, computed, mount } = createDOMView();
 * ```
 *
 * ## Import Guide
 *
 * | Use Case | Import |
 * |----------|--------|
 * | DOM apps | `import { createDOMView } from '@lattice/view'` |
 * | Custom adapter | `import { createView } from '@lattice/view'` |
 * | Extend/customize | `import { El, Map, Match } from '@lattice/view/extend'` |
 * | Types only | `import type { RefSpec, NodeRef } from '@lattice/view'` |
 *
 * ### Without a bundler
 *
 * The `/extend` path re-exports from individual modules for discoverability.
 * Bundlers tree-shake unused exports, but without a bundler each import
 * triggers a separate network request. For bundler-free usage, import directly:
 *
 * ```typescript
 * import { El } from '@lattice/view/el';
 * import { Map } from '@lattice/view/map';
 * ```
 */

// =============================================================================
// Primary API - What most users need
// =============================================================================

export { createDOMView } from './presets/dom';
export { createView } from './presets/core';
export type { DOMSvc, DOMViewSvc, DOMAdapterConfig } from './presets/dom';
export type {
  ViewSvc,
  ComponentFactory,
  // Service types
  ElFactory,
  ElService,
  MapFactory,
  MapService,
  MatchFactory,
  MatchService,
  PortalFactory,
  PortalService,
  ElementProps,
  TagFactory,
} from './presets/core';

// =============================================================================
// Core Types - For typing components and behaviors
// =============================================================================

export type {
  RefSpec,
  NodeRef,
  ElementRef,
  FragmentRef,
  ElRefSpecChild,
  LifecycleCallback,
  Readable,
  Writable,
  Reactive,
  ParentContext,
  BaseRef,
  LinkedNode,
  RenderScope,
  DisposableNode,
  PortalTarget,
  PortalOpts,
} from './types';

export {
  STATUS_ELEMENT,
  STATUS_FRAGMENT,
  STATUS_REF_SPEC,
  STATUS_COMMENT,
  STATUS_NODE_MASK,
  STATUS_SPEC_MASK,
} from './types';

export type { Adapter, AdapterConfig } from './adapter';
