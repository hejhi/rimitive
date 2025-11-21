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
  composeFrom,
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
  const signalSvc = composeFrom(
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

  return signalSvc;
};

const createInstrumentedViewApi = () => {
  const signalSvc = createInstrumentedSignals();
  const viewHelpers = defaultViewHelpers(createDOMRenderer(), signalSvc);
  const viewSvc = composeFrom(
    {
      el: El<DOMRendererConfig>({ instrument: instrumentEl }),
      map: Map<DOMRendererConfig>({ instrument: instrumentMap }),
      match: Match<DOMRendererConfig>(),
    },
    viewHelpers
  );
  const svc = {
    ...signalSvc,
    ...viewSvc,
    addEventListener: createAddEventListener(viewHelpers.batch),
  };

  type Service = typeof svc;

  return {
    service: {
      signals: signalSvc,
      view: viewSvc,
    },
    mount: <TElement>(spec: RefSpec<TElement>) => spec.create(viewSvc),
    useSvc: <TReturn>(fn: (svc: Service) => TReturn): TReturn => fn(svc),
  };
};

export const { service, mount, useSvc } = createInstrumentedViewApi();

export type Service = typeof service;
export type Signals = Service['signals'];
export type DOMViews = Service['view'];
