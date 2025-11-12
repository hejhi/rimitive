/**
 * App-level component factory with instrumentation
 *
 * Instrumentation is configured here at the API level, so all components
 * created with this API are automatically instrumented for devtools.
 */
import {
  createDOMRenderer,
  type DOMRendererConfig,
} from '@lattice/view/renderers/dom';
import { El } from '@lattice/view/el';
import { Map } from '@lattice/view/map';
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
import {
  instrumentEl,
  instrumentMap,
} from '@lattice/view/devtools';
import { createApi, createInstrumentation, devtoolsProvider } from '@lattice/lattice';
import { defaultHelpers } from '@lattice/signals/presets/core';
import { Match } from '@lattice/view/match';
import { ComponentFactory, defaultHelpers as defaultViewHelpers } from '@lattice/view/presets/core';
import { SealedSpec } from '@lattice/view/types';
import { create as createComponent } from '@lattice/view/component';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';

const instrumentation = createInstrumentation({
  providers: [devtoolsProvider()],
  enabled: true,
});


export const signals = createApi(
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
export type Signals = typeof signals;

const renderer = createDOMRenderer();
const viewHelpers = defaultViewHelpers(renderer, signals);

/**
 * DOM-specific API for this app
 * Types are automatically inferred from the renderer
 */
export const views = createApi(
  {
    el: El<DOMRendererConfig>({ instrument: instrumentEl }),
    map: Map<DOMRendererConfig>({ instrument: instrumentMap }),
    match: Match<DOMRendererConfig>(),
  },
  viewHelpers
);

export const mount = <TElement>(spec: SealedSpec<TElement>) => spec.create(views);

export const api = {
  ...signals,
  ...views,
  // Include addEventListener helper from view
  addEventListener: createAddEventListener(viewHelpers.batch),
};
export type CoreApi = typeof api;

export const create = createComponent as ComponentFactory<typeof api>;
export type DOMViews = typeof views;
