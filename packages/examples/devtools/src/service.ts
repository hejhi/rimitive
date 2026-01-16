/**
 * App-level service with instrumentation
 *
 * Demonstrates how to configure instrumentation at the service level.
 * All components using this service are automatically instrumented for devtools.
 */
import {
  compose,
  createInstrumentation,
  devtoolsProvider,
} from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  SubscribeModule,
} from '@rimitive/signals/extend';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';
import { createElModule } from '@rimitive/view/el';
import { createMapModule } from '@rimitive/view/map';
import { createMatchModule } from '@rimitive/view/match';
import { OnModule } from '@rimitive/view/deps/addEventListener';
import { MountModule } from '@rimitive/view/deps/mount';

// Create instrumentation
const instrumentation = createInstrumentation({
  providers: [devtoolsProvider({ debug: true })],
  enabled: true,
});

// Create the DOM adapter
const adapter = createDOMAdapter();

// Create adapter-bound view modules
const ElModule = createElModule(adapter);
const MapModule = createMapModule(adapter);
const MatchModule = createMatchModule(adapter);

// Compose everything together with instrumentation
const use = compose(
  // Signals
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  SubscribeModule,
  // View
  ElModule,
  MapModule,
  MatchModule,
  // Helpers
  OnModule,
  MountModule,
  // Options
  { instrumentation }
);

// Export primitives for direct import
export const {
  signal,
  computed,
  effect,
  batch,
  subscribe,
  el,
  map,
  match,
  on,
  mount,
} = use;
export { use };

// Export types
export type Service = ReturnType<typeof use>;
