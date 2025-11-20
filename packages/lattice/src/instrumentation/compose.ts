/**
 * Instrumentation composition utilities
 */

import type { InstrumentationContext } from '../extension';
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
 * Compose multiple instrumentation providers into a single context
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
 * Create an instrumentation context from configuration
 *
 * Type overloads provide precise return types based on config:
 * - When enabled is false → undefined
 * - When enabled is true and providers non-empty → InstrumentationContext
 * - Otherwise → InstrumentationContext | undefined
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
