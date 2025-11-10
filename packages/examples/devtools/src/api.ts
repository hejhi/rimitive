/**
 * App-level component factory with instrumentation
 *
 * Instrumentation is configured here at the API level, so all components
 * created with this API are automatically instrumented for devtools.
 */
import { createDOMRenderer } from '@lattice/view/renderers/dom';
import { createApi } from '@lattice/view/presets/core';
import { El } from '@lattice/view/el';
import { Map } from '@lattice/view/helpers/map';
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
import { instrumentEl, instrumentMap, instrumentOn } from '@lattice/view/devtools';
import { createApi as createReactiveApi } from '@lattice/signals/presets/core';
import { createInstrumentation, devtoolsProvider } from '@lattice/lattice';
import { createPushPullSchedule } from '@lattice/signals/helpers';

const instrumentation = createInstrumentation({
  providers: [devtoolsProvider()],
  enabled: true,
});

export const { create, api, mount } = createApi(
  createDOMRenderer(),
  {
    el: El({ instrument: instrumentEl }),
    map: Map({ instrument: instrumentMap }),
    on: On({ instrument: instrumentOn }),
  },
  createReactiveApi(
    {
      signal: Signal({ instrument: instrumentSignal }),
      computed: Computed({ instrument: instrumentComputed }),
      effect: Effect({ instrument: instrumentEffect }),
      batch: Batch({ instrument: instrumentBatch }),
      subscribe: Subscribe({ instrument: instrumentSubscribe }),
    },
    createPushPullSchedule(),
    { instrumentation }
  ),
  { instrumentation }
);