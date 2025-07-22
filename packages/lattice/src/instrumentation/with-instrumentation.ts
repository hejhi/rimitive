/**
 * Helper for creating instrumented contexts
 */

import type { LatticeExtension, ExtensionsToContext } from '../extension';
import { createContext } from '../extension';
import type { InstrumentationConfig } from './types';
import { createInstrumentation } from './compose';

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
export function withInstrumentation<E extends readonly LatticeExtension<string, unknown>[]>(
  config: InstrumentationConfig,
  ...extensions: E
): ExtensionsToContext<E> {
  const instrumentation = createInstrumentation(config);
  
  if (instrumentation) {
    return createContext({ instrumentation }, ...extensions);
  }
  
  // No instrumentation - create context without overhead
  return createContext(...extensions);
}