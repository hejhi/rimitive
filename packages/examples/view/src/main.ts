/**
 * Lattice View Example
 *
 * Demonstrates:
 * 1. Component Pattern - headless behaviors separated from UI
 * 2. View Primitives - el() and map() for reactive DOM
 * 3. Framework-agnostic - works without React, Vue, or any framework
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
import { createElFactory } from '@lattice/view/el';
import { createMapHelper } from '@lattice/view/helpers/map';
import { createLatticeContext } from '@lattice/view/context';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { createProcessChildren } from '@lattice/view/helpers/processChildren';
import { createScopes } from '@lattice/view/helpers/scope';
import { createScopedEffect } from '@lattice/view/helpers/scoped-effect';
import { createWithScope, createWithElementScope } from '@lattice/view/helpers/with-scope';
import { createOnFactory } from '@lattice/view/on';
import { Counter } from './components/Counter';
import { TodoList } from './components/TodoList';
import type { MapFactory } from './types';
import type { RefSpec, FragmentRef } from '@lattice/view/types';

// ============================================================================
// Create Lattice API with Signals + View
// ============================================================================

function createSignalContext() {
  const ctx = createBaseContext();
  const { detachAll, track, trackDependency } = createGraphEdges({ ctx });
  const { withVisitor } = createGraphTraversal();
  const _scheduler = createScheduler({ detachAll });
  const { withPropagate, ...scheduler } = _scheduler;
  const pullPropagator = createPullPropagator({ track });

  return {
    ctx,
    trackDependency,
    propagate: withPropagate(withVisitor),
    track,
    dispose: scheduler.dispose,
    pullUpdates: pullPropagator.pullUpdates,
    shallowPropagate: pullPropagator.shallowPropagate,
  };
}

// Create contexts
const signalCtx = createSignalContext();
const ctx = createLatticeContext();
const renderer = createDOMRenderer();

// Create adapter for GlobalContext compatibility
const latticeCtx = {
  get consumerScope() { return ctx.activeScope; },
  set consumerScope(value) { ctx.activeScope = value; },
  get trackingVersion() { return ctx.trackingVersion; },
  set trackingVersion(value) { ctx.trackingVersion = value; },
};

// Build signal factories
const signalFactory = createSignalFactory({
  ctx: latticeCtx,
  trackDependency: signalCtx.trackDependency,
  propagate: signalCtx.propagate,
});
const computedFactory = createComputedFactory({
  ctx: latticeCtx,
  trackDependency: signalCtx.trackDependency,
  track: signalCtx.track,
  pullUpdates: signalCtx.pullUpdates,
  shallowPropagate: signalCtx.shallowPropagate,
});
const effectFactory = createEffectFactory({
  ctx: latticeCtx,
  track: signalCtx.track,
  dispose: signalCtx.dispose,
});

const effect = effectFactory.method;

// Build view helpers
const { createScope, disposeScope } = createScopes({
  track: signalCtx.track,
  dispose: signalCtx.dispose,
});

const scopedEffect = createScopedEffect({ ctx, baseEffect: effect });
const withScope = createWithScope({ ctx, createScope });
const withElementScope = createWithElementScope({ ctx });

const { processChildren } = createProcessChildren({
  scopedEffect,
  renderer,
});

// Build view factories
const elFactory = createElFactory({
  ctx,
  scopedEffect,
  renderer,
  processChildren,
  withScope,
});

const mapHelper = createMapHelper<HTMLElement, Text>({
  ctx,
  scopedEffect,
  withElementScope,
  renderer,
  disposeScope,
});

const onFactory = createOnFactory({
  startBatch: () => 0, // No-op for simple example
  endBatch: () => 0,
});

// Create a factory wrapper for map
const mapFactory: MapFactory = {
  name: 'map',
  method: mapHelper as (render: () => RefSpec<HTMLElement> | RefSpec<HTMLElement>[]) => FragmentRef<HTMLElement>,
};

// Create the combined API
const api = createApi(
  {
    signal: () => signalFactory,
    computed: () => computedFactory,
    effect: () => effectFactory,
    el: () => elFactory,
    on: () => onFactory,
    map: () => mapFactory,
  },
  {} // No shared context needed
);

// ============================================================================
// Mount the App
// ============================================================================

const app = document.getElementById('app');
if (app) {
  // Create components using the full API
  const counter = Counter(api, 10);
  const todoList = TodoList(api);

  // Instantiate blueprints and append to DOM
  const counterEl = counter.create().element;
  const todoListEl = todoList.create().element;
  if (counterEl) app.appendChild(counterEl);
  if (todoListEl) app.appendChild(todoListEl);

  // Trigger lifecycle callbacks (for DOM connection observers)
  counter((el) => {
    console.log('Counter mounted', el);
  });

  todoList((el) => {
    console.log('TodoList mounted', el);
  });
}
