import {
  DefinedService,
  ExtractDeps,
  InstrumentationContext,
  LatticeContext,
  ServiceContext,
  ServiceDefinition,
  Svc,
} from './types';

type ContextState = {
  disposed: boolean;
  disposers: Set<() => void>;
};

export type CreateContextOptions = {
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

// ============================================================================
// Overload 1: Factory object + deps pattern
// compose({ signal: Signal(), computed: Computed() }, deps)
// ============================================================================
export function compose<
  T extends Record<string, DefinedService>,
  TDeps extends ExtractDeps<T>,
>(factories: T, deps: TDeps, options?: CreateContextOptions): Svc<T>;

// ============================================================================
// Overload 2: ServiceDefinitions (variadic)
// compose(signalService, computedService)
// ============================================================================
export function compose<
  TServices extends readonly ServiceDefinition<string, unknown>[],
>(...services: TServices): LatticeContext<TServices>;

// ============================================================================
// Overload 3: Options + ServiceDefinitions
// compose({ instrumentation }, signalService, computedService)
// ============================================================================
export function compose<
  TServices extends readonly ServiceDefinition<string, unknown>[],
>(
  options: CreateContextOptions,
  ...services: TServices
): LatticeContext<TServices>;

// ============================================================================
// Implementation
// ============================================================================
export function compose(
  ...args: unknown[]
): Record<string, unknown> & { dispose(): void } {
  // Detect which overload was called
  const firstArg = args[0];

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

    return composeServices(mappedServices, options);
  }

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
  const flatServices = services.flat(1) as ServiceDefinition<string, unknown>[];

  return composeServices(flatServices, options);
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
