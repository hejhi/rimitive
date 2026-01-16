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
 * Sends instrumentation events to the Rimitive DevTools browser extension
 * via `window.postMessage`. In debug mode, also logs to the console.
 *
 * @example Basic usage
 * ```ts
 * import { createInstrumentation, devtoolsProvider } from '@rimitive/core';
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
 * // [Rimitive DevTools] Event: signal:create { id: 'abc-123' }
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
    name: 'rimitive-devtools',

    init(contextId: string, contextName: string): void {
      if (typeof window === 'undefined') return;

      const announce = () => {
        window.postMessage(
          {
            source: 'rimitive-devtools',
            type: 'LATTICE_DETECTED',
            payload: {
              enabled: true,
              version: '1.0.0',
              contextId,
              contextName,
            },
          },
          '*'
        );
      };

      // Announce that Rimitive is being used with context info
      announce();

      // Listen for re-detection requests (from devtools reconnection)
      window.addEventListener('message', (event) => {
        if (
          event.source !== window ||
          !event.data ||
          typeof event.data !== 'object'
        ) {
          return;
        }

        const data = event.data as { source?: string; type?: string };
        if (
          data.source === 'rimitive-devtools-content' &&
          data.type === 'REQUEST_DETECTION'
        ) {
          announce();
        }
      });

      if (debug) {
        console.log(
          '[Rimitive DevTools] Initialized for context:',
          contextName,
          contextId
        );
      }
    },

    emit(event: InstrumentationEvent): void {
      if (typeof window === 'undefined') return;

      window.postMessage(
        {
          source: 'rimitive-devtools',
          type: 'EVENT',
          payload: event,
        },
        '*'
      );

      if (debug) {
        console.log('[Rimitive DevTools] Event:', event.type, event.data);
      }
    },

    register<T>(
      resource: T,
      type: string,
      name?: string
    ): { id: string; resource: T } {
      const id = crypto.randomUUID();

      if (debug) {
        console.log('[Rimitive DevTools] Registered:', type, name, id);
      }

      return { id, resource };
    },

    dispose(): void {
      if (debug) {
        console.log('[Rimitive DevTools] Provider disposed');
      }
    },
  };
}

/**
 * Check if Rimitive DevTools extension is available in the current environment.
 *
 * @example
 * ```ts
 * import { isDevtoolsAvailable, devtoolsProvider, createInstrumentation } from '@rimitive/core';
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
