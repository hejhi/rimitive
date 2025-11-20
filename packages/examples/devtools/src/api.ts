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
import { instrumentEl, instrumentMap } from '@lattice/view/devtools';
import {
  createApi,
  createInstrumentation,
  devtoolsProvider,
} from '@lattice/lattice';
import { defaultHelpers } from '@lattice/signals/presets/core';
import { Match } from '@lattice/view/match';
import { defaultHelpers as defaultViewHelpers } from '@lattice/view/presets/core';
import { RefSpec } from '@lattice/view/types';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';

const createInstrumentedSignals = () => {
  const instrumentation = createInstrumentation({
    providers: [devtoolsProvider()],
    enabled: true,
  });
  const signals = createApi(
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

  return signals;
}

const createInstrumentedViewApi = () => {
  const signals = createInstrumentedSignals();
  const viewHelpers = defaultViewHelpers(createDOMRenderer(), signals);
  const views = createApi(
    {
      el: El<DOMRendererConfig>({ instrument: instrumentEl }),
      map: Map<DOMRendererConfig>({ instrument: instrumentMap }),
      match: Match<DOMRendererConfig>(),
    },
    viewHelpers
  );
  const api = {
    ...signals,
    ...views,
    addEventListener: createAddEventListener(viewHelpers.batch),
  };

  type ApiType = typeof api;

  return {
    api,
    signals,
    views,
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(views),
    use: <TReturn>(fn: (api: ApiType) => TReturn): TReturn => fn(api),
  };
}

export const { api, signals, mount, use, views } = createInstrumentedViewApi();

export type Signals = typeof signals;
export type DOMViews = typeof views;
export type CoreApi = typeof api;
