import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { Effect } from '@lattice/signals/effect';
import { Batch } from '@lattice/signals/batch';
import { instrumentSignal } from '@lattice/signals/devtools/signal';
import { instrumentComputed } from '@lattice/signals/devtools/computed';
import { instrumentEffect } from '@lattice/signals/devtools/effect';
import { instrumentBatch } from '@lattice/signals/devtools/batch';
import {
  devtoolsProvider,
  createInstrumentation,
  composeFrom,
} from '@lattice/lattice';

import { createPushPullSchedule } from '@lattice/signals/helpers';

function createSignalApi() {
  const instrumentation = createInstrumentation({
    providers: [devtoolsProvider()],
    enabled: true,
  });

  return composeFrom(
    {
      signal: Signal({ instrument: instrumentSignal }),
      computed: Computed({ instrument: instrumentComputed }),
      effect: Effect({ instrument: instrumentEffect }),
      batch: Batch({ instrument: instrumentBatch }),
    },
    createPushPullSchedule(),
    { instrumentation }
  );
}

export const api = createSignalApi();
