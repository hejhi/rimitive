import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { Effect } from '@lattice/signals/effect';
import { Batch } from '@lattice/signals/batch';
import { instrumentSignal } from '@lattice/signals/devtools/signal';
import { instrumentComputed } from '@lattice/signals/devtools/computed';
import { instrumentEffect } from '@lattice/signals/devtools/effect';
import { instrumentBatch } from '@lattice/signals/devtools/batch';
import {
  composeFrom,
  createInstrumentation,
  devtoolsProvider,
} from '@lattice/lattice';
import { defaultHelpers } from '@lattice/signals/presets/core';

// Create instrumented signals service
const instrumentation = createInstrumentation({
  providers: [devtoolsProvider()],
  enabled: true,
});

export const service = composeFrom(
  {
    signal: Signal({ instrument: instrumentSignal }),
    computed: Computed({ instrument: instrumentComputed }),
    effect: Effect({ instrument: instrumentEffect }),
    batch: Batch({ instrument: instrumentBatch }),
  },
  defaultHelpers(),
  { instrumentation }
);

// Export the service type for behaviors
export type Service = typeof service;
