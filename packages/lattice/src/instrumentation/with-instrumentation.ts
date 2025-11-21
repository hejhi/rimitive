import { compose } from '../compose';
import type { InstrumentationConfig } from './types';
import { createInstrumentation } from './compose';
import type { LatticeContext, ServiceDefinition } from 'src/types';

/**
 * Create a Lattice context with instrumentation
 *
 * @example
 * ```typescript
 * const ctx = withInstrumentation({
 *   enabled: import.meta.env.DEV,
 *   providers: [devtoolsProvider(), performanceProvider()]
 * }, signalExtension, computedExtension, effectExtension);
 * ```
 */
export function withInstrumentation<
  E extends readonly ServiceDefinition<string, unknown>[],
>(config: InstrumentationConfig, ...extensions: E): LatticeContext<E> {
  const instrumentation = createInstrumentation(config);

  if (instrumentation) {
    return compose({ instrumentation }, ...extensions);
  }

  // No instrumentation - create context without overhead
  return compose(...extensions);
}
