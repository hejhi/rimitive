/**
 * An instrumentation event emitted by services.
 *
 * @example
 * ```ts
 * const event: InstrumentationEvent = {
 *   type: 'signal:write',
 *   timestamp: Date.now(),
 *   data: {
 *     signalId: 'abc-123',
 *     oldValue: 0,
 *     newValue: 1,
 *   },
 * };
 * ```
 */
export type InstrumentationEvent = {
  /** Event type identifier (e.g., 'signal:create', 'effect:run') */
  type: string;
  /** Timestamp when the event occurred */
  timestamp: number;
  /** Event-specific payload data */
  data: Record<string, unknown>;
  /** Context ID (automatically added by the instrumentation system) */
  contextId?: string;
};

/**
 * An instrumentation provider that receives and processes events.
 *
 * Providers are the output targets for instrumentation data.
 * Examples: DevTools, logging, analytics, performance monitoring.
 *
 * @example Custom logging provider
 * ```ts
 * const loggingProvider: InstrumentationProvider = {
 *   name: 'console-logger',
 *
 *   init(contextId, contextName) {
 *     console.log(`[${contextName}] Instrumentation started`);
 *   },
 *
 *   emit(event) {
 *     console.log(`[${event.type}]`, event.data);
 *   },
 *
 *   register(resource, type, name) {
 *     const id = crypto.randomUUID();
 *     console.log(`Registered ${type}: ${name ?? id}`);
 *     return { id, resource };
 *   },
 *
 *   dispose() {
 *     console.log('Instrumentation stopped');
 *   },
 * };
 * ```
 */
export type InstrumentationProvider = {
  /** Unique name for this provider */
  name: string;
  /** Called when the provider is initialized with a context */
  init(contextId: string, contextName: string): void;
  /** Called when an instrumentation event is emitted */
  emit(event: InstrumentationEvent): void;
  /** Register a resource for tracking, returns a generated ID */
  register<T>(
    resource: T,
    type: string,
    name?: string
  ): { id: string; resource: T };
  /** Optional cleanup when the provider is disposed */
  dispose?(): void;
};

/**
 * Configuration for creating an instrumentation context.
 *
 * @example
 * ```ts
 * import { createInstrumentation, devtoolsProvider } from '@lattice/lattice';
 *
 * const instrumentation = createInstrumentation({
 *   enabled: import.meta.env.DEV, // Only in development
 *   providers: [devtoolsProvider({ debug: true })],
 * });
 * ```
 *
 * @example Dynamic enabled check
 * ```ts
 * const instrumentation = createInstrumentation({
 *   enabled: () => localStorage.getItem('debug') === 'true',
 *   providers: [devtoolsProvider()],
 * });
 * ```
 */
export type InstrumentationConfig = {
  /** Array of providers to receive instrumentation data */
  providers: InstrumentationProvider[];
  /** Enable/disable instrumentation. Defaults to true. */
  enabled?: boolean | (() => boolean);
};
