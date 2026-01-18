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

// Create the DOM adapter
const adapter = createDOMAdapter();

// Create adapter-bound view modules
const ElModule = createElModule(adapter);
const MapModule = createMapModule(adapter);
const MatchModule = createMatchModule(adapter);

/**
 * Create a named service with instrumentation.
 * Each service shows up separately in DevTools.
 */
export function createService(name: string) {
  // Create instrumentation with the service name
  const instrumentation = createInstrumentation({
    providers: [devtoolsProvider()],
    enabled: true,
    name,
  });

  // Compose everything together with instrumentation
  return compose(
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
}

// Export the service type
export type Service = ReturnType<typeof createService>;
