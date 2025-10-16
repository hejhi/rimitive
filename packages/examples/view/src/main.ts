/**
 * Lattice View Example
 *
 * Demonstrates:
 * 1. Component Pattern - headless behaviors separated from UI
 * 2. View Primitives - el() and elMap() for reactive DOM
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
import { createElMapFactory } from '@lattice/view/elMap';
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

// Create an intermediate signal function for elMap
const signalFn = signalFactory.method;

// Build view factories
const elFactory = createElFactory({ ctx: viewCtx, effect: effectWrapper, renderer });
const elMapFactory = createElMapFactory({
  ctx: viewCtx,
  signal: signalFn,
  effect: effectWrapper,
  renderer,
});

// Create the combined API
const rawApi = createApi(
  {
    signal: () => signalFactory,
    computed: () => computedFactory,
    effect: () => effectFactory,
    el: () => elFactory,
    elMap: () => elMapFactory,
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

  // Append to DOM (renderer returns HTMLElement for DOM renderer)
  app.appendChild(counter() as HTMLElement);
  app.appendChild(todoList() as HTMLElement);

  // Trigger lifecycle callbacks (for DOM connection observers)
  counter((el) => {
    console.log('Counter mounted', el);
  });

  todoList((el) => {
    console.log('TodoList mounted', el);
  });
}
