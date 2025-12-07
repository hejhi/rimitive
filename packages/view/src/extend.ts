/**
 * @lattice/view/extend - Extension API for custom view compositions
 *
 * Use this module when you need to:
 * - Create custom adapters (Canvas, WebGL, native, etc.)
 * - Build custom view presets with different primitives
 * - Wire view primitives with custom signals implementations
 *
 * ## Example: Custom Adapter
 * ```typescript
 * import { El, Map, Match, createViewSvc } from '@lattice/view/extend';
 * import { createSignalsSvc } from '@lattice/signals';
 * import { myCustomAdapter } from './my-adapter';
 *
 * const signals = createSignalsSvc();
 * const svc = createViewSvc(myCustomAdapter, signals);
 * ```
 */

// =============================================================================
// Primitive Factories - For custom composition
// =============================================================================

export { El } from './el';
export { Map } from './map';
export { Match } from './match';
export { Portal } from './portal';

// =============================================================================
// View Service Factories
// =============================================================================

export { createViewSvc } from './presets/core';
export { createDOMSvc } from './presets/dom';

// =============================================================================
// Adapters
// =============================================================================

export { createDOMAdapter } from './adapters/dom';
export { createTestAdapter } from './adapters/test';
export type { DOMAdapterConfig } from './adapters/dom';

// =============================================================================
// Helpers - For building custom presets
// =============================================================================

export { createScopes } from './helpers/scope';
export { createAddEventListener } from './helpers/addEventListener';
export { createUse } from './helpers/use';

// =============================================================================
// Factory Types - For typing custom services
// =============================================================================

export type {
  ElFactory,
  ElOpts,
  ElProps,
  TagFactory,
  ElementProps,
} from './el';
export type { MapFactory, MapOpts } from './map';
export type { MatchFactory, MatchOpts } from './match';
export type { PortalFactory, PortalOpts, PortalTarget } from './portal';

// =============================================================================
// Helper Types
// =============================================================================

export type { CreateScopes } from './helpers/scope';
export type { AddEventListener } from './helpers/addEventListener';
export type { Use } from './helpers/use';

// =============================================================================
// Core Types
// =============================================================================

export type {
  Adapter,
  AdapterConfig,
  RefSpec,
  NodeRef,
  ElementRef,
  FragmentRef,
  LinkedNode,
  RenderScope,
  ParentContext,
} from './types';
