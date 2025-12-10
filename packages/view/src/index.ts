/**
 * @lattice/view - Declarative view primitives for Lattice
 *
 * ## Quick Start
 * ```typescript
 * import { compose } from '@lattice/lattice';
 * import { SignalModule, ComputedModule, EffectModule, BatchModule } from '@lattice/signals/extend';
 * import { createDOMAdapter } from '@lattice/view/adapters/dom';
 * import { createElModule } from '@lattice/view/el';
 * import { createMapModule } from '@lattice/view/map';
 * import { MountModule } from '@lattice/view/deps/mount';
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
 * | DOM adapter | `import { createDOMAdapter } from '@lattice/view/adapters/dom'` |
 * | View modules | `import { createElModule } from '@lattice/view/el'` |
 * | Types only | `import type { RefSpec, NodeRef } from '@lattice/view'` |
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

export {
  STATUS_ELEMENT,
  STATUS_FRAGMENT,
  STATUS_REF_SPEC,
  STATUS_COMMENT,
  STATUS_NODE_MASK,
  STATUS_SPEC_MASK,
} from './types';

export type { Adapter, AdapterConfig } from './adapter';

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
} from './load';

export {
  ASYNC_FRAGMENT,
  isAsyncFragment,
  getAsyncMeta,
  createLoadFactory,
  LoadModule,
} from './load';
