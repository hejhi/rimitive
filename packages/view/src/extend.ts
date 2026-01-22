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
 * import { createElModule } from '@rimitive/view/el';
 * import { myCustomAdapter } from './my-adapter';
 *
 * const svc = compose(SignalModule, ComputedModule, EffectModule, createElModule(myCustomAdapter));
 * ```
 */

// =============================================================================
// Primitive Factories - For custom composition
// =============================================================================

export { createElFactory } from './el';
export { createMapFactory } from './map';
export { createMatchFactory } from './match';
export { createPortalFactory } from './portal';

// =============================================================================
// Adapters
// =============================================================================

export { createDOMAdapter } from './adapters/dom';
export { createTestAdapter } from './adapters/test';
export type { DOMTreeConfig } from './adapters/dom';

// =============================================================================
// Helpers - For building custom compositions
// =============================================================================

export { createScopes } from './deps/scope';
export { createAddEventListener } from './deps/addEventListener';
export { createUse } from './deps/use';

// =============================================================================
// Factory Types - For typing custom services
// =============================================================================

export type { ElFactory, ElOpts, TagFactory, ElementProps } from './el';
export type { MapFactory, MapOpts } from './map';
export type { MatchFactory, MatchOpts } from './match';
export type { PortalFactory, PortalOpts, PortalTarget } from './portal';

// =============================================================================
// Helper Types
// =============================================================================

export type { CreateScopes } from './deps/scope';
export type { AddEventListener } from './deps/addEventListener';
export type { Use } from './deps/use';

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
