import type {
  DefinedService,
  ExtractDeps,
  InstrumentationContext,
  LatticeContext,
  ServiceContext,
  ServiceDefinition,
  Svc,
  Use,
} from './types';

type ContextState = {
  disposed: boolean;
  disposers: Set<() => void>;
};

/**
 * Options for creating a composed context
 *
 * @example
 * ```ts
 * import { compose, createInstrumentation, devtoolsProvider } from '@lattice/lattice';
 * import { Signal, Computed, deps } from '@lattice/signals/extend';
 *
 * const instrumentation = createInstrumentation({
 *   enabled: true,
 *   providers: [devtoolsProvider()],
 * });
 *
 * const use = compose(
 *   { signal: Signal(), computed: Computed() },
 *   deps(),
 *   { instrumentation }
 * );
 * ```
 */
export type CreateContextOptions = {
  /** Optional instrumentation context for debugging/profiling */
  instrumentation?: InstrumentationContext;
};

/**
 * Check if a value is a DefinedService (factory with .create method)
 */
function isDefinedService(value: unknown): value is DefinedService {
  return (
    value !== null &&
    typeof value === 'object' &&
    'create' in value &&
    typeof (value as DefinedService).create === 'function'
  );
}

/**
 * Check if a value is a factories object (Record<string, DefinedService>)
 */
function isFactoriesObject(
  value: unknown
): value is Record<string, DefinedService> {
  if (value === null || typeof value !== 'object') return false;
  // Must have at least one key and all values must be DefinedService
  const entries = Object.entries(value);
  return entries.length > 0 && entries.every(([, v]) => isDefinedService(v));
}

/**
 * Compose service factories into a unified context with shared dependencies.
 *
 * Returns a `use()` function that provides access to the composed context:
 * - `use()` - Returns the service context directly
 * - `use(callback)` - Passes the context to callback and returns its result
 *
 * This is the primary way to create a Lattice context. It supports three patterns:
 *
 * **Pattern 1: Factory object + deps** (recommended for most cases)
 * Pass an object of service factories and shared dependencies.
 *
 * @example
 * ```ts
 * import { compose } from '@lattice/lattice';
 * import { Signal, Computed, Effect, deps } from '@lattice/signals/extend';
 *
 * const use = compose(
 *   { signal: Signal(), computed: Computed(), effect: Effect() },
 *   deps()
 * );
 *
 * // Get the service directly
 * const { signal, computed } = use();
 *
 * // Or wrap a component
 * const Counter = use(({ signal }) => () => {
 *   const count = signal(0);
 *   return count;
 * });
 * ```
 *
 * **Pattern 2: Pre-created ServiceDefinitions**
 * Pass already-instantiated service definitions.
 *
 * @example
 * ```ts
 * import { Signal, Computed, deps } from '@lattice/signals/extend';
 *
 * const helpers = deps();
 * const signalService = Signal().create(helpers);
 * const computedService = Computed().create(helpers);
 *
 * const use = compose(signalService, computedService);
 * const { signal, computed } = use();
 * ```
 *
 * **Pattern 3: With instrumentation**
 * Add debugging/profiling to any composition pattern.
 *
 * @example
 * ```ts
 * import { compose, createInstrumentation, devtoolsProvider } from '@lattice/lattice';
 * import { Signal, Computed, deps } from '@lattice/signals/extend';
 *
 * const instrumentation = createInstrumentation({
 *   providers: [devtoolsProvider()],
 * });
 *
 * const use = compose(
 *   { signal: Signal(), computed: Computed() },
 *   deps(),
 *   { instrumentation }
 * );
 * ```
 *
 * @returns A `use()` function for accessing the composed service context
 */
// Overload 1: Factory object + deps pattern
export function compose<
  T extends Record<string, DefinedService>,
  TDeps extends ExtractDeps<T>,
>(
  factories: T | DefinedService,
  deps: TDeps,
  options?: CreateContextOptions
): Use<Svc<T>>;

// Overload 2: ServiceDefinitions (variadic)
export function compose<
  TServices extends readonly ServiceDefinition<string, unknown>[],
>(...services: TServices): Use<LatticeContext<TServices>>;

// Overload 3: Options + ServiceDefinitions
export function compose<
  TServices extends readonly ServiceDefinition<string, unknown>[],
>(
  options: CreateContextOptions,
  ...services: TServices
): Use<LatticeContext<TServices>>;

// Implementation
export function compose(
  ...args: unknown[]
): Use<Record<string, unknown> & { dispose(): void }> {
  // Detect which overload was called
  const firstArg = args[0];

  let svc: Record<string, unknown> & { dispose(): void };

  // Pattern 1: Factory object + deps
  // compose({ signal: Signal(), computed: Computed() }, deps, options?)
  if (isFactoriesObject(firstArg)) {
    const factories = firstArg;
    const deps = args[1];
    const options = args[2] as CreateContextOptions | undefined;

    // Map factories to service definitions
    const mappedServices = Object.values(factories).map((factory) =>
      factory.create(deps)
    );

    svc = composeServices(mappedServices, options);
  } else {
    // Pattern 2 & 3: ServiceDefinitions (with optional leading options)
    let services: ServiceDefinition<string, unknown>[];
    let options: CreateContextOptions | undefined;

    if (
      firstArg &&
      typeof firstArg === 'object' &&
      'instrumentation' in firstArg
    ) {
      // Pattern 3: Options object first
      options = firstArg as CreateContextOptions;
      services = args.slice(1) as ServiceDefinition<string, unknown>[];
    } else {
      // Pattern 2: Just services
      services = args as ServiceDefinition<string, unknown>[];
    }

    // Flatten in case of arrays
    const flatServices = services.flat(1) as ServiceDefinition<
      string,
      unknown
    >[];

    svc = composeServices(flatServices, options);
  }

  // Return a use() function
  type SvcType = typeof svc;

  const use = <TResult>(
    callback?: (s: SvcType) => TResult
  ): SvcType | TResult => {
    if (callback === undefined) {
      return svc;
    }
    return callback(svc);
  };

  return use as Use<SvcType>;
}

/**
 * Core composition logic - takes instantiated ServiceDefinitions and creates context
 */
function composeServices(
  services: ServiceDefinition<string, unknown>[],
  options?: CreateContextOptions
): Record<string, unknown> & { dispose(): void } {
  // Validate no duplicate names
  const names = new Set<string>();
  for (const service of services) {
    if (names.has(service.name)) {
      throw new Error(`Duplicate service name: ${service.name}`);
    }
    names.add(service.name);
  }

  const state: ContextState = {
    disposed: false,
    disposers: new Set(),
  };

  const serviceCtx: ServiceContext = {
    destroy(cleanup: () => void): void {
      state.disposers.add(cleanup);
    },

    get isDestroyed(): boolean {
      return state.disposed;
    },
  };

  // Build the context object
  const context: Record<string, unknown> & { dispose(): void } = {
    dispose(): void {
      if (state.disposed) return;
      state.disposed = true;

      for (const service of services) {
        service.destroy?.(serviceCtx);
      }

      for (const disposer of state.disposers) {
        disposer();
      }
      state.disposers.clear();
    },
  };

  // Add each service's impl to the context
  for (const service of services) {
    service.init?.(serviceCtx);
    let impl = service.impl;

    if (options?.instrumentation && service.instrument) {
      impl = service.instrument(impl, options.instrumentation, serviceCtx);
    }

    if (service.adapt) impl = service.adapt(impl, serviceCtx);

    context[service.name] = impl;
  }

  return context;
}

/**
 * Extend a composed service with additional functionality.
 *
 * Takes a `Use<TSvc>` and an extender function, returning a new `Use<TExtended>`.
 * This preserves the composition pattern through extensions, allowing further
 * chaining with additional `extend` calls.
 *
 * @example
 * ```ts
 * import { compose, extend } from '@lattice/lattice';
 * import { Signal, deps } from '@lattice/signals/extend';
 *
 * const base = compose({ signal: Signal() }, deps());
 *
 * const extended = extend(base, (svc) => ({
 *   ...svc,
 *   customMethod: () => console.log('extended!'),
 * }));
 *
 * // Use like any other composed service
 * const { signal, customMethod } = extended();
 *
 * // Or wrap components
 * const Component = extended(({ signal, customMethod }) => () => {
 *   // ...
 * });
 * ```
 *
 * @example Chaining multiple extensions
 * ```ts
 * const final = extend(
 *   extend(base, (svc) => ({ ...svc, foo: 'foo' })),
 *   (svc) => ({ ...svc, bar: 'bar' })
 * );
 * ```
 */
export function extend<TSvc, TExtended>(
  use: Use<TSvc>,
  extender: (svc: TSvc) => TExtended
): Use<TExtended> {
  const extended = extender(use());

  const extendedUse = <TResult>(
    callback?: (svc: TExtended) => TResult
  ): TExtended | TResult => {
    if (callback === undefined) {
      return extended;
    }
    return callback(extended);
  };

  return extendedUse as Use<TExtended>;
}
