/**
 * Instrumentation composition utilities
 */

import { InstrumentationContext } from 'src/types';
import type {
  InstrumentationEvent,
  InstrumentationProvider,
  InstrumentationConfig,
} from './types';

/**
 * Check if instrumentation is enabled
 */
function isEnabled(config: InstrumentationConfig): boolean {
  if (config.enabled === undefined) return true;
  return typeof config.enabled === 'function'
    ? config.enabled()
    : config.enabled;
}

/**
 * Compose multiple instrumentation providers into a single context.
 *
 * Events are fanned out to all providers. If a provider throws, the error
 * is logged but other providers still receive the event.
 *
 * @example
 * ```ts
 * import { composeProviders, devtoolsProvider } from '@lattice/lattice';
 *
 * const customProvider = { name: 'custom', ... };
 * const ctx = composeProviders([devtoolsProvider(), customProvider]);
 *
 * ctx.emit({ type: 'test', timestamp: Date.now(), data: {} });
 * // Both providers receive the event
 * ```
 */
export function composeProviders(
  providers: InstrumentationProvider[]
): InstrumentationContext {
  if (providers.length === 0) {
    throw new Error('At least one instrumentation provider is required');
  }

  const contextId = crypto.randomUUID();
  const contextName = 'Context';

  // Initialize all providers
  providers.forEach((provider) => {
    provider.init(contextId, contextName);
  });

  return {
    contextId,
    contextName,

    emit(event: InstrumentationEvent): void {
      // Add contextId to event if not present
      const enrichedEvent = { ...event, contextId };

      // Fan out to all providers
      providers.forEach((provider) => {
        try {
          provider.emit(enrichedEvent);
        } catch (error) {
          console.error(
            `Instrumentation provider "${provider.name}" failed to handle event:`,
            error
          );
        }
      });
    },

    register<T>(
      resource: T,
      type: string,
      name?: string
    ): { id: string; resource: T } {
      // Let first provider generate the ID
      const firstProvider = providers[0];
      if (!firstProvider) {
        throw new Error('No providers available');
      }
      const result = firstProvider.register(resource, type, name);

      // Share the same resource registration with other providers
      for (let i = 1; i < providers.length; i++) {
        const provider = providers[i];
        if (provider) {
          try {
            provider.register(resource, type, name);
          } catch (error) {
            console.error(
              `Instrumentation provider "${provider.name}" failed to register resource:`,
              error
            );
          }
        }
      }

      return result;
    },
  };
}

/**
 * Create an instrumentation context from configuration.
 *
 * This is the main entry point for setting up instrumentation.
 * Returns `undefined` if instrumentation is disabled, allowing
 * safe optional chaining in production.
 *
 * Type overloads provide precise return types:
 * - `enabled: false` → always returns `undefined`
 * - `enabled: true` with providers → always returns `InstrumentationContext`
 * - Otherwise → `InstrumentationContext | undefined`
 *
 * @example Basic usage
 * ```ts
 * import { createInstrumentation, devtoolsProvider, compose } from '@lattice/lattice';
 * import { SignalModule, ComputedModule } from '@lattice/signals/extend';
 *
 * const instrumentation = createInstrumentation({
 *   enabled: import.meta.env.DEV,
 *   providers: [devtoolsProvider()],
 * });
 *
 * // Use with compose
 * const svc = compose(SignalModule, ComputedModule, { instrumentation });
 * ```
 *
 * @example Production-safe pattern
 * ```ts
 * // Returns undefined in production (enabled: false)
 * const instrumentation = createInstrumentation({
 *   enabled: false,
 *   providers: [],
 * });
 *
 * // Type is `undefined`, no runtime overhead
 * ```
 *
 * @example Multiple providers
 * ```ts
 * const instrumentation = createInstrumentation({
 *   providers: [
 *     devtoolsProvider(),
 *     analyticsProvider(),
 *     loggingProvider({ verbose: true }),
 *   ],
 * });
 * ```
 */

// Overload: enabled is explicitly false → always returns undefined
export function createInstrumentation(
  config: InstrumentationConfig & { enabled: false }
): undefined;

// Overload: enabled is true and providers guaranteed non-empty → always returns InstrumentationContext
export function createInstrumentation(
  config: Omit<InstrumentationConfig, 'enabled' | 'providers'> & {
    enabled: true;
    providers: [InstrumentationProvider, ...InstrumentationProvider[]];
  }
): InstrumentationContext;

// Overload: enabled omitted (defaults to true) and providers guaranteed non-empty → always returns InstrumentationContext
export function createInstrumentation(
  config: Omit<InstrumentationConfig, 'providers'> & {
    providers: [InstrumentationProvider, ...InstrumentationProvider[]];
  }
): InstrumentationContext;

// General case: may return undefined
export function createInstrumentation(
  config: InstrumentationConfig
): InstrumentationContext | undefined;

// Implementation
export function createInstrumentation(
  config: InstrumentationConfig
): InstrumentationContext | undefined {
  if (!isEnabled(config)) return undefined;

  return composeProviders(config.providers);
}
