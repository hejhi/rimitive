import type { InstrumentationProvider, InstrumentationEvent } from '../types';

/**
 * Options for the DevTools instrumentation provider.
 */
export type DevtoolsProviderOptions = {
  /** Log events to console for debugging */
  debug?: boolean;
};

/**
 * Create a DevTools instrumentation provider.
 *
 * Sends instrumentation events to the Lattice DevTools browser extension
 * via `window.postMessage`. In debug mode, also logs to the console.
 *
 * @example Basic usage
 * ```ts
 * import { createInstrumentation, devtoolsProvider } from '@lattice/lattice';
 *
 * const instrumentation = createInstrumentation({
 *   providers: [devtoolsProvider()],
 * });
 * ```
 *
 * @example With debug logging
 * ```ts
 * const instrumentation = createInstrumentation({
 *   providers: [devtoolsProvider({ debug: true })],
 * });
 *
 * // Events are logged to console:
 * // [Lattice DevTools] Event: signal:create { id: 'abc-123' }
 * ```
 *
 * @example Conditional for development only
 * ```ts
 * const instrumentation = createInstrumentation({
 *   enabled: import.meta.env.DEV,
 *   providers: [devtoolsProvider({ debug: import.meta.env.DEV })],
 * });
 * ```
 */
export function devtoolsProvider(
  options: DevtoolsProviderOptions = {}
): InstrumentationProvider {
  const { debug = false } = options;

  return {
    name: 'lattice-devtools',

    init(contextId: string, contextName: string): void {
      if (typeof window === 'undefined') return;

      // Announce that Lattice is being used
      window.postMessage(
        {
          source: 'lattice-devtools',
          type: 'LATTICE_DETECTED',
          payload: {
            enabled: true,
            version: '1.0.0',
          },
        },
        '*'
      );

      if (debug) {
        console.log(
          '[Lattice DevTools] Initialized for context:',
          contextName,
          contextId
        );
      }
    },

    emit(event: InstrumentationEvent): void {
      if (typeof window === 'undefined') return;

      window.postMessage(
        {
          source: 'lattice-devtools',
          type: 'EVENT',
          payload: event,
        },
        '*'
      );

      if (debug) {
        console.log('[Lattice DevTools] Event:', event.type, event.data);
      }
    },

    register<T>(
      resource: T,
      type: string,
      name?: string
    ): { id: string; resource: T } {
      const id = crypto.randomUUID();

      if (debug) {
        console.log('[Lattice DevTools] Registered:', type, name, id);
      }

      return { id, resource };
    },

    dispose(): void {
      if (debug) {
        console.log('[Lattice DevTools] Provider disposed');
      }
    },
  };
}

/**
 * Check if Lattice DevTools extension is available in the current environment.
 *
 * @example
 * ```ts
 * import { isDevtoolsAvailable, devtoolsProvider, createInstrumentation } from '@lattice/lattice';
 *
 * // Only enable instrumentation if DevTools is installed
 * const instrumentation = createInstrumentation({
 *   enabled: isDevtoolsAvailable(),
 *   providers: [devtoolsProvider()],
 * });
 * ```
 */
export function isDevtoolsAvailable(): boolean {
  return typeof window !== 'undefined' && '__LATTICE_DEVTOOLS__' in window;
}
