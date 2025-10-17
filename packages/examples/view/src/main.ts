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
import { createMapFactory } from '@lattice/view/map';
import { createMatchFactory } from '@lattice/view/match';
import { createViewContext } from '@lattice/view/context';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import type { LatticeViewAPI } from './types';
import { Counter } from './components/Counter';
import { TodoList } from './components/TodoList';

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
const viewCtx = createViewContext();
const renderer = createDOMRenderer();

// Build signal factories
const signalFactory = createSignalFactory(signalCtx);
const computedFactory = createComputedFactory(signalCtx);
const effectFactory = createEffectFactory(signalCtx);

// Create effect wrapper for view primitives - uses the actual effect factory
const effectWrapper = (fn: () => void | (() => void)): (() => void) => {
  return effectFactory.method(fn);
};

// Create an intermediate signal function for map
const signalFn = signalFactory.method;

// Build view factories
const elFactory = createElFactory({ ctx: viewCtx, effect: effectWrapper, renderer });
const mapFactory = createMapFactory({
  ctx: viewCtx,
  signal: signalFn,
  effect: effectWrapper,
  renderer,
});
const matchFactory = createMatchFactory({ ctx: viewCtx, effect: effectWrapper, renderer });

// Create the combined API
const rawApi = createApi(
  {
    signal: () => signalFactory,
    computed: () => computedFactory,
    effect: () => effectFactory,
    el: () => elFactory,
    map: () => mapFactory,
    match: () => matchFactory,
  },
  {} // No shared context needed
);

// Type-cast to our expected API shape
const api = rawApi as unknown as LatticeViewAPI;

// ============================================================================
// Mount the App
// ============================================================================

const app = document.getElementById('app');
if (app) {
  // Create components using the full API
  const counter = Counter(api, 10);
  const todoList = TodoList(api);

  // Instantiate blueprints and append to DOM
  app.appendChild(counter.create().element as HTMLElement);
  app.appendChild(todoList.create().element as HTMLElement);

  // Trigger lifecycle callbacks (for DOM connection observers)
  counter((el) => {
    console.log('Counter mounted', el);
  });

  todoList((el) => {
    console.log('TodoList mounted', el);
  });
}
