/**
 * App-level API with instrumentation
 *
 * Demonstrates how to configure instrumentation at the service level.
 * All components using this API are automatically instrumented for devtools.
 */
import {
  createDOMAdapter,
  type DOMAdapterConfig,
} from '@lattice/view/adapters/dom';
import { El } from '@lattice/view/el';
import { Map } from '@lattice/view/map';
import { Match } from '@lattice/view/match';
import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { Effect } from '@lattice/signals/effect';
import { Batch } from '@lattice/signals/batch';
import { Subscribe } from '@lattice/signals/subscribe';
import { instrumentSignal } from '@lattice/signals/devtools/signal';
import { instrumentComputed } from '@lattice/signals/devtools/computed';
import { instrumentEffect } from '@lattice/signals/devtools/effect';
import { instrumentBatch } from '@lattice/signals/devtools/batch';
import { instrumentSubscribe } from '@lattice/signals/devtools/subscribe';
import { instrumentEl, instrumentMap } from '@lattice/view/devtools';
import {
  composeFrom,
  createInstrumentation,
  devtoolsProvider,
} from '@lattice/lattice';
import { defaultHelpers } from '@lattice/signals/presets/core';
import { defaultHelpers as defaultViewHelpers } from '@lattice/view/presets/core';
import { RefSpec } from '@lattice/view/types';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';

// Create instrumentation
const instrumentation = createInstrumentation({
  providers: [devtoolsProvider()],
  enabled: true,
});

// Create instrumented signals
const signalsSvc = composeFrom(
  {
    signal: Signal({ instrument: instrumentSignal }),
    computed: Computed({ instrument: instrumentComputed }),
    effect: Effect({ instrument: instrumentEffect }),
    batch: Batch({ instrument: instrumentBatch }),
    subscribe: Subscribe({ instrument: instrumentSubscribe }),
  },
  defaultHelpers(),
  { instrumentation }
);

// Create instrumented view
const adapter = createDOMAdapter();
const viewHelpers = defaultViewHelpers(adapter, signalsSvc);
const viewSvc = composeFrom(
  {
    el: El<DOMAdapterConfig>({ instrument: instrumentEl }),
    map: Map<DOMAdapterConfig>({ instrument: instrumentMap }),
    match: Match<DOMAdapterConfig>(),
  },
  viewHelpers
);

// Combined service
const svc = {
  ...signalsSvc,
  ...viewSvc,
  on: createAddEventListener(viewHelpers.batch),
};

// Export primitives for direct import
export const { signal, computed, effect, batch, subscribe } = signalsSvc;
export const { el, map, match } = viewSvc;
export const { on } = svc;

// Export mount helper
export const mount = <TElement>(spec: RefSpec<TElement>) => spec.create(svc);

// Export types
export type Service = typeof svc;
export type Signals = typeof signalsSvc;
export type Views = typeof viewSvc;
