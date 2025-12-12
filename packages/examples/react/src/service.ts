import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';
import {
  compose,
  createInstrumentation,
  devtoolsProvider,
} from '@rimitive/core';

// Create instrumented signals service
const instrumentation = createInstrumentation({
  providers: [devtoolsProvider()],
  enabled: true,
});

export const service = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
  { instrumentation }
);

// Export the service type for behaviors
export type Service = typeof service;
