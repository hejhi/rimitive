/**
 * A factory that creates service instances with injected dependencies.
 *
 * Services are created by `defineService` and have a `.create(deps)` method
 * that wires dependencies and returns a `ServiceDefinition`.
 *
 * @example
 * ```ts
 * import { Signal } from '@lattice/signals';
 *
 * // Signal() returns a Service
 * const signalService = Signal();
 *
 * // .create() wires dependencies and returns ServiceDefinition
 * const signalDef = signalService.create(deps);
 * ```
 */
export type Service<TResult, TContext> = {
  /**
   * Create an instance with the provided dependencies
   *
   * @param context - The dependencies required to instantiate the service
   * @returns The instantiated ServiceDefinition
   */
  create(context: TContext): TResult;
};

/**
 * A service definition that can be composed into a Lattice context.
 *
 * ServiceDefinitions are the building blocks of Lattice composition.
 * They describe an implementation plus optional lifecycle hooks.
 *
 * @example Basic service definition
 * ```ts
 * const counterService: ServiceDefinition<'counter', CounterImpl> = {
 *   name: 'counter',
 *   impl: {
 *     value: 0,
 *     increment() { this.value++; },
 *   },
 * };
 *
 * const ctx = compose(counterService);
 * ctx.counter.increment();
 * ```
 *
 * @example With lifecycle hooks
 * ```ts
 * const timerService: ServiceDefinition<'timer', TimerImpl> = {
 *   name: 'timer',
 *   impl: createTimer(),
 *   init(ctx) {
 *     // Called when added to context
 *     this.impl.start();
 *   },
 *   destroy(ctx) {
 *     // Called when context is disposed
 *     this.impl.stop();
 *   },
 * };
 * ```
 *
 * @example With adapt hook for context awareness
 * ```ts
 * const resourceService: ServiceDefinition<'resource', () => Resource> = {
 *   name: 'resource',
 *   impl: () => createResource(),
 *   adapt(impl, ctx) {
 *     return () => {
 *       if (ctx.isDestroyed) throw new Error('Context disposed');
 *       const resource = impl();
 *       ctx.destroy(() => resource.cleanup());
 *       return resource;
 *     };
 *   },
 * };
 * ```
 */
export type ServiceDefinition<TName extends string, TImpl> = {
  /**
   * Unique name for this service (becomes the property name on context)
   */
  name: TName;

  /**
   * The actual implementation exposed on the context
   */
  impl: TImpl;

  /**
   * Optional wrapper to add context awareness (disposal checks, tracking, etc.)
   * Called after `instrument` if both are present.
   */
  adapt?(impl: TImpl, context: ServiceContext): TImpl;

  /**
   * Optional instrumentation wrapper for debugging/profiling.
   * Called before `adapt` if both are present.
   */
  instrument?(
    impl: TImpl,
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ): TImpl;

  /**
   * Called when the service is added to a context.
   * Use for initialization logic.
   */
  init?(context: ServiceContext): void;

  /**
   * Called when the context is disposed.
   * Use for cleanup logic (or register cleanup via `context.destroy()`).
   */
  destroy?(context: ServiceContext): void;
};

/**
 * Context provided to services for lifecycle management.
 *
 * Passed to `init`, `destroy`, `adapt`, and `instrument` hooks.
 *
 * @example
 * ```ts
 * const myService: ServiceDefinition<'my', MyImpl> = {
 *   name: 'my',
 *   impl: createImpl(),
 *   adapt(impl, ctx) {
 *     // Check disposal state
 *     if (ctx.isDestroyed) throw new Error('Already disposed');
 *
 *     // Register cleanup
 *     ctx.destroy(() => impl.cleanup());
 *
 *     return impl;
 *   },
 * };
 * ```
 */
export type ServiceContext = {
  /**
   * Register a cleanup function to be called when context is disposed.
   * Multiple cleanup functions can be registered.
   */
  destroy(cleanup: () => void): void;

  /**
   * Check if the context has been disposed.
   * Useful for guarding operations in async callbacks.
   */
  readonly isDestroyed: boolean;
};

/**
 * Instrumentation context for debugging and profiling.
 *
 * Passed to the `instrument` hook of services when instrumentation is enabled.
 *
 * @example
 * ```ts
 * const signalService: ServiceDefinition<'signal', SignalImpl> = {
 *   name: 'signal',
 *   impl: createSignal,
 *   instrument(impl, instr, ctx) {
 *     return (value) => {
 *       const { id, resource: signal } = instr.register(impl(value), 'signal');
 *
 *       // Emit event on creation
 *       instr.emit({
 *         type: 'signal:create',
 *         timestamp: Date.now(),
 *         data: { id, initialValue: value },
 *       });
 *
 *       return signal;
 *     };
 *   },
 * };
 * ```
 */
export type InstrumentationContext = {
  /**
   * Unique ID for this context instance
   */
  contextId: string;

  /**
   * Human-readable name of the context (for debugging)
   */
  contextName: string;

  /**
   * Emit an instrumentation event to all registered providers
   */
  emit(event: {
    type: string;
    timestamp: number;
    data: Record<string, unknown>;
  }): void;

  /**
   * Register a resource for tracking.
   * Returns an object with a generated ID and the resource.
   */
  register<T>(
    resource: T,
    type: string,
    name?: string
  ): { id: string; resource: T };
};

/**
 * Extract the implementation type from a ServiceDefinition.
 *
 * @example
 * ```ts
 * type SignalDef = ServiceDefinition<'signal', <T>(v: T) => SignalFn<T>>;
 * type SignalImpl = ServiceImpl<SignalDef>;
 * // SignalImpl = <T>(v: T) => SignalFn<T>
 * ```
 */
export type ServiceImpl<TService> =
  TService extends ServiceDefinition<string, infer M> ? M : never;

/**
 * Extract the name from a ServiceDefinition.
 *
 * @example
 * ```ts
 * type SignalDef = ServiceDefinition<'signal', SignalImpl>;
 * type Name = ServiceName<SignalDef>;
 * // Name = 'signal'
 * ```
 */
export type ServiceName<TService> =
  TService extends ServiceDefinition<infer N, unknown> ? N : never;

/**
 * The composed context type for a tuple of ServiceDefinitions.
 *
 * Maps service names to their implementations and adds a `dispose()` method.
 *
 * @example
 * ```ts
 * type SignalDef = ServiceDefinition<'signal', SignalImpl>;
 * type ComputedDef = ServiceDefinition<'computed', ComputedImpl>;
 *
 * type Ctx = LatticeContext<[SignalDef, ComputedDef]>;
 * // Ctx = { signal: SignalImpl; computed: ComputedImpl; dispose(): void }
 * ```
 */
export type LatticeContext<
  TService extends readonly ServiceDefinition<string, unknown>[],
> = {
  [K in TService[number] as ServiceName<K>]: ServiceImpl<K>;
} & {
  dispose(): void;
};

/**
 * A service factory returned by `defineService()`.
 *
 * Has a `.create(deps)` method that wires dependencies.
 * This is what you pass to `compose()`.
 *
 * @example
 * ```ts
 * // Signal() returns DefinedService
 * const signalFactory: DefinedService = Signal();
 *
 * // Used with compose
 * const ctx = compose({ signal: signalFactory }, deps);
 * ```
 */
export type DefinedService<TDeps = unknown> = Service<
  ServiceDefinition<string, TDeps>,
  TDeps
>;

/**
 * Utility type: Convert a union to an intersection.
 * Used internally to combine dependency requirements.
 */
export type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

/**
 * Extract the combined dependency type from a record of DefinedServices.
 *
 * Used by `compose()` to infer the required deps parameter.
 *
 * @example
 * ```ts
 * type Factories = {
 *   signal: DefinedService<{ consumer: Consumer }>;
 *   computed: DefinedService<{ track: TrackFn }>;
 * };
 *
 * type Deps = ExtractDeps<Factories>;
 * // Deps = { consumer: Consumer } & { track: TrackFn }
 * ```
 */
export type ExtractDeps<T extends Record<string, DefinedService>> =
  UnionToIntersection<T[keyof T] extends Service<unknown, infer C> ? C : never>;

/**
 * The composed context type for object-based composition.
 *
 * Extracts impl types from service factories, preserving key names.
 *
 * @example
 * ```ts
 * type Factories = {
 *   signal: DefinedService<SignalDeps>;
 *   computed: DefinedService<ComputedDeps>;
 * };
 *
 * type Ctx = Svc<Factories>;
 * // Ctx = { signal: SignalImpl; computed: ComputedImpl; dispose(): void }
 * ```
 */
export type Svc<T extends Record<string, DefinedService>> = {
  [K in keyof T]: T[K] extends Service<
    ServiceDefinition<string, infer TImpl>,
    unknown
  >
    ? TImpl
    : never;
} & {
  dispose(): void;
};

/**
 * A callable returned by `compose()` that provides access to the service context.
 *
 * Can be called in two ways:
 * - `use()` - Returns the service context directly
 * - `use(callback)` - Passes the context to callback and returns its result
 *
 * @example
 * ```ts
 * const use = compose({ signal: Signal() }, deps);
 *
 * // Get the service directly
 * const { signal, computed } = use();
 *
 * // Wrap a component with service access
 * const Counter = use(({ signal, computed }) => () => {
 *   const count = signal(0);
 *   return el('div')(computed(() => count()));
 * });
 * ```
 */
export type Use<TSvc> = {
  /** Returns the service context directly */
  (): TSvc;
  /** Passes the context to callback and returns its result */
  <TResult>(callback: (svc: TSvc) => TResult): TResult;
};
