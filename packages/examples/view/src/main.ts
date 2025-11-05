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
import { createCreateFactory } from '@lattice/view/create';
import { Counter } from './components/Counter';
import { TodoList } from './components/TodoList';
import { ConditionalExample } from './components/ConditionalExample';
import type { LatticeViewAPI } from '@lattice/view/component';
import type { RefSpec, NodeRef } from '@lattice/view/types';

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

// Create the combined API with self-reference for create extension
type FullAPI = LatticeViewAPI<HTMLElement> & { create: <T extends RefSpec<HTMLElement>>(spec: T) => NodeRef<HTMLElement> };

// First create without create extension
let api = createApi(
  {
    signal: () => signalFactory,
    computed: () => computedFactory,
    effect: () => effectFactory,
    el: () => elFactory,
    on: () => onFactory,
    map: () => mapFactory,
  },
  {}
) as unknown as FullAPI; // Cast to allow self-reference

// Then recreate with create extension that references the api
api = createApi(
  {
    signal: () => signalFactory,
    computed: () => computedFactory,
    effect: () => effectFactory,
    el: () => elFactory,
    on: () => onFactory,
    map: () => mapFactory,
    create: () => createCreateFactory({ api }), // Now api exists!
  },
  {} // No shared context needed
) as unknown as FullAPI;

// ============================================================================
// Mount the App
// ============================================================================

const app = document.getElementById('app')!;

// Get el for building the root
const { el } = api;

// Build spec tree - no API needed during composition!
const appSpec = el('div', { className: 'app' })(
  Counter(10),
  ConditionalExample(),
  TodoList()
)();

// Instantiate with API - flows down automatically to all components
const appRef = api.create(appSpec);
app.appendChild(appRef.element as HTMLElement);
