/**
 * Instrumented Signals API
 *
 * Creates and exports the signals API with DevTools instrumentation.
 * Provides: signal, computed, effect, batch
 */

import { Signal } from '@lattice/signals/signal';
import { Computed } from '@lattice/signals/computed';
import { Effect } from '@lattice/signals/effect';
import { Batch } from '@lattice/signals/batch';
import { instrumentSignal } from '@lattice/signals/devtools/signal';
import { instrumentComputed } from '@lattice/signals/devtools/computed';
import { instrumentEffect } from '@lattice/signals/devtools/effect';
import { instrumentBatch } from '@lattice/signals/devtools/batch';
import { devtoolsProvider, createInstrumentation } from '@lattice/lattice';
import { createCoreCtx } from '@lattice/signals/presets/core';
import { Subscribe } from '@lattice/signals/subscribe';

export function createSignalContext() {
  const coreCtx = createCoreCtx();

  const instrumentation = createInstrumentation({
    enabled: true,
    providers: [devtoolsProvider({ debug: true })],
  });

  return {
    ...coreCtx,
    instrumentation,
  };
}

export const signalsExtensions = {
  signal: Signal({ instrument: instrumentSignal }),
  computed: Computed({ instrument: instrumentComputed }),
  effect: Effect({ instrument: instrumentEffect }),
  batch: Batch({ instrument: instrumentBatch }),
  subscribe: Subscribe({ instrument: instrumentSubscribe })
};
