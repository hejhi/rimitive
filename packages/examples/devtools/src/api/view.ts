/**
 * Instrumented View API
 *
 * Creates and exports the view API with DevTools instrumentation.
 * Provides: el, map, on, signal, computed, effect
 */

import { El } from '@lattice/view/el';
import { Map } from '@lattice/view/helpers/map';
import { On } from '@lattice/view/on';
import { createLatticeContext as createViewContext } from '@lattice/view/context';
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { createProcessChildren } from '@lattice/view/helpers/processChildren';
import { createScopes } from '@lattice/view/helpers/scope';
import { instrumentEl, instrumentMap, instrumentOn } from '@lattice/view/devtools';
import { createContext as createLatticeContext } from '@lattice/lattice';
import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { Effect } from '@lattice/signals/effect';
import { instrumentSignal } from '@lattice/signals/devtools/signal';
import { instrumentComputed } from '@lattice/signals/devtools/computed';
import { instrumentEffect } from '@lattice/signals/devtools/effect';
import { signalCtx } from './signals';

// Create view context
const viewCtx = createViewContext<HTMLElement>();
const renderer = createDOMRenderer();

// Create signal extensions with instrumentation
const signalExtension = Signal().create({ ...signalCtx, instrument: instrumentSignal });
const computedExtension = Computed().create({ ...signalCtx, instrument: instrumentComputed });
const effectExtension = Effect().create({ ...signalCtx, instrument: instrumentEffect });

const effect = effectExtension.method;
const signal = signalExtension.method;

// Create view primitives
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

// Create view context object for extensions
const viewContext = {
  ctx: viewCtx,
  scopedEffect,
  renderer,
  processChildren,
  createElementScope,
  disposeScope,
  onCleanup,
  signalCtx: signalCtx.ctx,
  signal: signal,
  startBatch: signalCtx.startBatch,
  endBatch: signalCtx.endBatch,
};

// Create view extensions with instrumentation
const viewExtensions = [
  El().create({ ...viewContext, instrument: instrumentEl }),
  Map().create({ ...viewContext, instrument: instrumentMap }),
  On().create({ ...viewContext, instrument: instrumentOn }),
];

export const viewApi = createLatticeContext(
  { instrumentation: signalCtx.instrumentation },
  signalExtension,
  computedExtension,
  effectExtension,
  ...viewExtensions
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const { el, map, on, signal: viewSignal, computed, effect: viewEffect } = viewApi as any;

/**
 * Mount a component to the DOM using the instrumented view API
 */
export function mount(selector: string, component: any) {
  const nodeRef = component.create(viewApi);
  const container = document.querySelector(selector);

  if (!container) {
    throw new Error(`Mount point not found: ${selector}`);
  }

  if ('element' in nodeRef && nodeRef.element) {
    container.appendChild(nodeRef.element as unknown as Node);
  }

  return nodeRef;
}
