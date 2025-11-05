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
import { createOnFactory } from '@lattice/view/on';
import { Counter } from './components/Counter';
import { TodoList } from './components/TodoList';
import { ConditionalExample } from './components/ConditionalExample';
import { create } from '@lattice/view/component';

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
const ctx = createLatticeContext<HTMLElement>();
const renderer = createDOMRenderer();

// Use the signal context for reactivity (consumerScope is for reactive tracking, NOT view lifecycle)
const latticeCtx = signalCtx.ctx;

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
const { disposeScope, scopedEffect, createElementScope, onCleanup } = createScopes<HTMLElement>({
  ctx,
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
  ctx,
  scopedEffect,
  renderer,
  processChildren,
  createElementScope,
  disposeScope,
  onCleanup,
});

const mapFactory = createMapHelper<HTMLElement, Text>({
  ctx,
  signalCtx: latticeCtx,
  signal: signalFactory.method,
  scopedEffect,
  renderer,
  disposeScope,
});

const onFactory = createOnFactory({
  startBatch: () => 0, // No-op for simple example
  endBatch: () => 0,
});

// Create API once
const api = createApi(
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

// ============================================================================
// Define App Component
// ============================================================================

const App = create(({ el }) => () => {
  return el('div', { className: 'app' })(
    Counter(10),
    ConditionalExample(),
    TodoList()
  )();
});

// ============================================================================
// Mount the App
// ============================================================================

const app = document.getElementById('app')!;
app.appendChild(App().create(api).element!);
