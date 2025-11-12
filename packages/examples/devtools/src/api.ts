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
import { createApi } from '@lattice/view/presets/core';
import { El } from '@lattice/view/el';
import { Map } from '@lattice/view/map';
import { On } from '@lattice/view/on';
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
  instrumentOn,
} from '@lattice/view/devtools';
import { createApi as createSignals } from '@lattice/signals/presets/core';
import { createInstrumentation, devtoolsProvider } from '@lattice/lattice';
import { createPushPullSchedule } from '@lattice/signals/helpers';

const instrumentation = createInstrumentation({
  providers: [devtoolsProvider()],
  enabled: true,
});

const signals = createSignals(
  {
    signal: Signal({ instrument: instrumentSignal }),
    computed: Computed({ instrument: instrumentComputed }),
    effect: Effect({ instrument: instrumentEffect }),
    batch: Batch({ instrument: instrumentBatch }),
    subscribe: Subscribe({ instrument: instrumentSubscribe }),
  },
  createPushPullSchedule(),
  { instrumentation }
).api;

export type Signals = typeof signals;

export const { create, api, mount } = createApi(
  createDOMRenderer(),
  {
    el: El<DOMRendererConfig>({
      instrument: (method, instrumentation) =>
        instrumentEl<DOMRendererConfig>(method, instrumentation),
    }),
    map: Map<DOMRendererConfig>({
      instrument: (method, instrumentation) =>
        instrumentMap<DOMRendererConfig>(method, instrumentation),
    }),
    on: On({ instrument: instrumentOn }),
  },
  signals,
  { instrumentation }
);
