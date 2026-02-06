/**
 * @rimitive/view - View layer tooling for Rimitive
 *
 * ## Quick Start
 * ```typescript
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule, EffectModule, BatchModule } from '@rimitive/signals/extend';
 * import { createDOMAdapter } from '@rimitive/view/adapters/dom';
 * import { ElModule } from '@rimitive/view/el';
 * import { MapModule } from '@rimitive/view/map';
 * import { MountModule } from '@rimitive/view/deps/mount';
 *
 * const adapter = createDOMAdapter();
 * const svc = compose(
 *   SignalModule, ComputedModule, EffectModule, BatchModule,
 *   ElModule.with({ adapter }),
 *   MapModule.with({ adapter }),
 *   MountModule
 * )();
 * ```
 *
 * ## Import Guide
 *
 * | Use Case | Import |
 * |----------|--------|
 * | DOM adapter | `import { createDOMAdapter } from '@rimitive/view/adapters/dom'` |
 * | View modules | `import { ElModule } from '@rimitive/view/el'` |
 * | Types only | `import type { RefSpec, NodeRef } from '@rimitive/view'` |
 */

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

// =============================================================================
// Shadow - Shadow DOM encapsulation
// =============================================================================

export type {
  ShadowOptions,
  ShadowMode,
  ShadowFactory,
  ShadowService,
  ShadowLifecycleCallback,
} from './shadow';

export { createShadowFactory, createShadowModule } from './shadow';

export {
  STATUS_ELEMENT,
  STATUS_FRAGMENT,
  STATUS_REF_SPEC,
  STATUS_COMMENT,
  STATUS_NODE_MASK,
  STATUS_SPEC_MASK,
} from './types';

export type { Adapter, TreeConfig, NodeOf, NodeType } from './adapter';

// =============================================================================
// Error Boundary - Error catching and fallback rendering
// =============================================================================

export type {
  ErrorBoundaryFactory,
  ErrorBoundaryOpts,
  ErrorBoundaryMeta,
  ErrorBoundaryFragment,
} from './error-boundary';

export {
  ERROR_BOUNDARY,
  isErrorBoundaryFragment,
  getErrorBoundaryMeta,
  createErrorBoundaryFactory,
  ErrorBoundaryModule,
} from './error-boundary';

// =============================================================================
// Load - Async data loading boundaries
// =============================================================================

export type {
  LoadStatus,
  LoadState,
  LoadFactory,
  LoadOpts,
  AsyncFragment,
  AsyncMeta,
  LoadFn,
  Loader,
} from './load';

export {
  ASYNC_FRAGMENT,
  isAsyncFragment,
  getAsyncMeta,
  createLoadFactory,
  createLoader,
  LoadModule,
} from './load';

// =============================================================================
// Lazy - Lazy-loaded dynamic imports
// =============================================================================

export { createLazyFunction, LazyModule } from './lazy';
export type { LazyFunction, LazyOpts } from './lazy';

// =============================================================================
// Mount - Entry point for rendering with automatic effect scoping
// =============================================================================

export { mount } from './deps/mount';
