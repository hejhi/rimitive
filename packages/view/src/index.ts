/**
 * @rimitive/view - View layer tooling for Rimitive
 *
 * ## Quick Start
 * ```typescript
 * import { compose } from '@rimitive/core';
 * import { SignalModule, ComputedModule, EffectModule, BatchModule } from '@rimitive/signals/extend';
 * import { createDOMAdapter } from '@rimitive/view/adapters/dom';
 * import { createElModule } from '@rimitive/view/el';
 * import { createMapModule } from '@rimitive/view/map';
 * import { MountModule } from '@rimitive/view/deps/mount';
 *
 * const adapter = createDOMAdapter();
 * const svc = compose(
 *   SignalModule, ComputedModule, EffectModule, BatchModule,
 *   createElModule(adapter), createMapModule(adapter), MountModule
 * )();
 * ```
 *
 * ## Import Guide
 *
 * | Use Case | Import |
 * |----------|--------|
 * | DOM adapter | `import { createDOMAdapter } from '@rimitive/view/adapters/dom'` |
 * | View modules | `import { createElModule } from '@rimitive/view/el'` |
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
// Mount - Entry point for rendering with automatic effect scoping
// =============================================================================

export { mount } from './deps/mount';
