import { compose, createInstrumentation, perfProvider } from '@rimitive/core';
import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';
import { ElModule } from '@rimitive/view/el';
import { MapModule } from '@rimitive/view/map';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { createPerfAdapter } from '@rimitive/view/adapters/perf';
import { MountModule } from '@rimitive/view/deps/mount';

// Set up instrumentation with Performance API provider
// This sends signal/computed/effect events to Chrome DevTools Performance panel
const instrumentation = createInstrumentation({
  providers: [perfProvider()],
});

// Wrap the DOM adapter with performance visualization
const perfAdapter = createPerfAdapter(createDOMAdapter(), {
  flashDuration: 500,
  frequencyThreshold: 3,
  frequencyWindow: 500,
  showToolbar: true,
  onSlowRender: (el, ms) => {
    console.warn(`Slow render: ${ms.toFixed(1)}ms`, el);
  },
  onFrequentUpdate: (el, count) => {
    console.warn(`Frequent updates: ${count} in 500ms`, el);
  },
  onLongTask: (ms, els) => {
    console.warn(`Long task: ${ms.toFixed(1)}ms — may have caused jank`, els);
  },
});

const svc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  ElModule.with({ adapter: perfAdapter }),
  MapModule.with({ adapter: perfAdapter }),
  MountModule,
  { instrumentation }
);

export const { signal, computed, effect, el, map, mount } = svc;
