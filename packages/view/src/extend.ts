/**
 * @rimitive/view/extend - Extension API for custom view compositions
 *
 * Use this module when you need to:
 * - Create custom adapters (Canvas, WebGL, native, etc.)
 * - Build custom view compositions with different primitives
 * - Wire view primitives with custom signals implementations
 *
 * ## Example: Custom Adapter
 * ```typescript
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
 * import { ElModule } from '@rimitive/view/el';
 * import { myCustomAdapter } from './my-adapter';
 *
 * const svc = compose(
 *   SignalModule,
 *   ComputedModule,
 *   EffectModule,
 *   ElModule.with({ adapter: myCustomAdapter })
 * );
 * ```
 */

// =============================================================================
// Configurable View Modules
// =============================================================================

export { ElModule, createElFactory } from './el';
export { MapModule, createMapFactory } from './map';
export { MatchModule, createMatchFactory } from './match';
export { ErrorBoundaryModule, createErrorBoundaryFactory } from './error-boundary';
export { createPortalFactory } from './portal';
export { createShadowFactory } from './shadow';

// =============================================================================
// Adapters
// =============================================================================

export { createDOMAdapter } from './adapters/dom';
export { createTestAdapter } from './adapters/test';
export type { DOMTreeConfig } from './adapters/dom';

// =============================================================================
// Helpers - For building custom compositions
// =============================================================================

export { createScopes, ScopesModule } from './deps/scope';
export { createAddEventListener } from './deps/addEventListener';
export { createUse } from './deps/use';
export { mount } from './deps/mount';

// =============================================================================
// Factory Types - For typing custom services
// =============================================================================

export type { ElFactory, ElOpts, TagFactory, ElementProps } from './el';
export type { MapFactory } from './map';
export type { MatchFactory, MatchOpts } from './match';
export type { ErrorBoundaryFactory, ErrorBoundaryOpts } from './error-boundary';
export type { PortalFactory, PortalOpts, PortalTarget } from './portal';
export type {
  ShadowFactory,
  ShadowOpts,
  ShadowOptions,
  ShadowService,
  ShadowMode,
  ShadowLifecycleCallback,
} from './shadow';

// =============================================================================
// Helper Types
// =============================================================================

export type { CreateScopes } from './deps/scope';
export type { AddEventListener } from './deps/addEventListener';
export type { Use } from './deps/use';

// =============================================================================
// Lazy - Lazy-loaded dynamic imports
// =============================================================================

export { createLazyFunction, LazyModule } from './lazy';
export type { LazyFunction, LazyOpts } from './lazy';

// =============================================================================
// Core Types
// =============================================================================

export type {
  Adapter,
  TreeConfig,
  NodeOf,
  NodeType,
  RefSpec,
  NodeRef,
  ElementRef,
  FragmentRef,
  LinkedNode,
  RenderScope,
  ParentContext,
} from './types';
