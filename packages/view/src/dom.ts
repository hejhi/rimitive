/**
 * DOM preset for @lattice/view
 *
 * Provides zero-config API creation for DOM-based applications.
 * All the internal wiring is handled automatically.
 *
 * For advanced use cases requiring custom configuration, import individual
 * factories from their respective modules.
 * ```
 */

import { createApi } from '@lattice/lattice';
import { createSignalFactory } from '@lattice/signals/signal';
import { createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory } from '@lattice/signals/effect';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';
import { createElFactory } from './el';
import { createMapHelper } from './helpers/map';
import { createLatticeContext } from './context';
import { createDOMRenderer } from './renderers/dom';
import { createProcessChildren } from './helpers/processChildren';
import { createScopes } from './helpers/scope';
import { createOnFactory } from './on';
import type { LatticeViewAPI } from './component';
import type { SealedSpec } from './types';

/**
 * Options for configuring the DOM API
 */
export interface DOMAPIOptions {
  /**
   * Enable batching for event handlers
   * When true, multiple updates within an event handler are batched together
   * @default false
   */
  batching?: boolean;

  /**
   * Callback invoked when a batch starts
   * Only used if batching is enabled
   */
  onBatchStart?: () => void;

  /**
   * Callback invoked when a batch ends
   * Only used if batching is enabled
   */
  onBatchEnd?: () => void;
}

/**
 * Create a complete Lattice View API for DOM rendering with signals
 *
 * This function handles all the internal wiring between the signals system
 * and the view layer, providing a ready-to-use API for building reactive
 * DOM applications.
 */
export function createDOMAPI(options: DOMAPIOptions = {}): LatticeViewAPI<HTMLElement> {
  // Create signal context infrastructure
  const ctx = createBaseContext();
  const { detachAll, track, trackDependency } = createGraphEdges({ ctx });
  const { withVisitor } = createGraphTraversal();
  const _scheduler = createScheduler({ detachAll });
  const { withPropagate, ...scheduler } = _scheduler;
  const pullPropagator = createPullPropagator({ track });

  // Signal context object
  const signalCtx = {
    ctx,
    trackDependency,
    propagate: withPropagate(withVisitor),
    track,
    dispose: scheduler.dispose,
    pullUpdates: pullPropagator.pullUpdates,
    shallowPropagate: pullPropagator.shallowPropagate,
  };

  // Create view context
  const viewCtx = createLatticeContext<HTMLElement>();
  const renderer = createDOMRenderer();

  // Build signal factories
  const signalFactory = createSignalFactory({
    ctx: signalCtx.ctx,
    trackDependency: signalCtx.trackDependency,
    propagate: signalCtx.propagate,
  });

  const computedFactory = createComputedFactory({
    ctx: signalCtx.ctx,
    trackDependency: signalCtx.trackDependency,
    track: signalCtx.track,
    pullUpdates: signalCtx.pullUpdates,
    shallowPropagate: signalCtx.shallowPropagate,
  });

  const effectFactory = createEffectFactory({
    ctx: signalCtx.ctx,
    track: signalCtx.track,
    dispose: signalCtx.dispose,
  });

  const effect = effectFactory.method;

  // Build view helpers
  const { disposeScope, scopedEffect, createElementScope, onCleanup } = createScopes<HTMLElement>({
    ctx: viewCtx,
    track: signalCtx.track,
    dispose: signalCtx.dispose,
    baseEffect: effect,
  });

  const { processChildren } = createProcessChildren<HTMLElement, Text>({
    scopedEffect,
    renderer,
  });

  // Build view factories
  const elFactory = createElFactory<HTMLElement, Text>({
    ctx: viewCtx,
    scopedEffect,
    renderer,
    processChildren,
    createElementScope,
    disposeScope,
    onCleanup,
  });

  const mapFactory = createMapHelper<HTMLElement, Text>({
    ctx: viewCtx,
    signalCtx: signalCtx.ctx,
    signal: signalFactory.method,
    scopedEffect,
    renderer,
    disposeScope,
  });

  // Handle batching configuration
  const startBatch = options.batching && options.onBatchStart
    ? () => { options.onBatchStart!(); return 0; }
    : () => 0;
  const endBatch = options.batching && options.onBatchEnd
    ? () => { options.onBatchEnd!(); return 0; }
    : () => 0;

  const onFactory = createOnFactory({
    startBatch,
    endBatch,
  });

  // Compose into unified API
  const api: LatticeViewAPI<HTMLElement> = createApi(
    {
      signal: () => signalFactory,
      computed: () => computedFactory,
      effect: () => effectFactory,
      el: () => elFactory,
      on: () => onFactory,
      map: () => mapFactory,
    },
    {}
  );

  return api;
}

/**
 * Mount a component to the DOM
 *
 * This is a convenience helper that creates a DOM API, instantiates the component,
 * and appends it to the specified container.
 */
export function mount(
  selector: string,
  component: SealedSpec<unknown>,
  options?: DOMAPIOptions
) {
  const api = createDOMAPI(options);
  const nodeRef = component.create(api);
  const container = document.querySelector(selector);

  if (!container) {
    throw new Error(`Mount point not found: ${selector}`);
  }

  if ('element' in nodeRef && nodeRef.element) {
    container.appendChild(nodeRef.element as unknown as Node);
  }

  return nodeRef;
}
