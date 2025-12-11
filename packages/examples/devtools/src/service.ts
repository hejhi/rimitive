/**
 * App-level service with instrumentation
 *
 * Demonstrates how to configure instrumentation at the service level.
 * All components using this service are automatically instrumented for devtools.
 */
import { compose, createInstrumentation, devtoolsProvider } from '@lattice/lattice';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  SubscribeModule,
} from '@lattice/signals/extend';
import { createDOMAdapter } from '@lattice/view/adapters/dom';
import { createElModule } from '@lattice/view/el';
import { createMapModule } from '@lattice/view/map';
import { createMatchModule } from '@lattice/view/match';
import { OnModule } from '@lattice/view/deps/addEventListener';
import { MountModule } from '@lattice/view/deps/mount';

// Create instrumentation
const instrumentation = createInstrumentation({
  providers: [devtoolsProvider()],
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
