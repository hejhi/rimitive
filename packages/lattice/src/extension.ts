/**
 * @fileoverview Lattice context system
 *
 * Provides a unified interface for all lattice functionality through services and context.
 * This allows optimal tree-shaking and easy extensibility.
 */

/**
 * Context provided to services for lifecycle management
 */
export interface ServiceContext {
  /**
   * Register a cleanup function to be called when context is disposed
   */
  destroy(cleanup: () => void): void;

  /**
   * Check if the context has been disposed
   */
  readonly isDestroyed: boolean;
}

/**
 * Instrumentation context provided to services
 */
export interface InstrumentationContext {
  /**
   * Unique ID for this context instance
   */
  contextId: string;

  /**
   * Name of the context (for debugging)
   */
  contextName: string;

  /**
   * Emit an instrumentation event
   */
  emit(event: {
    type: string;
    timestamp: number;
    data: Record<string, unknown>;
  }): void;

  /**
   * Register a resource for tracking
   */
  register<T>(
    resource: T,
    type: string,
    name?: string
  ): { id: string; resource: T };
}

/**
 * Base interface for all lattice services
 */
export interface Service<TName extends string, TImpl> {
  /**
   * Unique name for this service (becomes the impl name on context)
   */
  name: TName;

  /**
   * The actual implementation
   */
  impl: TImpl;

  /**
   * Optional wrapper to add context awareness (disposal checks, tracking, etc.)
   */
  adapt?(impl: TImpl, context: ServiceContext): TImpl;

  /**
   * Optional instrumentation wrapper for debugging/profiling
   */
  instrument?(
    impl: TImpl,
    instrumentation: InstrumentationContext,
    context: ServiceContext
  ): TImpl;

  /**
   * Called when the service is added to a context
   */
  init?(context: ServiceContext): void;

  /**
   * Called when the context is disposed
   */
  destroy?(context: ServiceContext): void;
}

/**
 * Helper type to extract the impl type from an service
 */
export type ServiceImpl<TService> =
  TService extends Service<string, infer M> ? M : never;

/**
 * Helper type to extract the name from an service
 */
export type ServiceName<TService> =
  TService extends Service<infer N, unknown> ? N : never;

/**
 * Convert a tuple of services into a context type
 */
export type LatticeContext<
  TService extends readonly Service<string, unknown>[],
> = {
  [K in TService[number] as ServiceName<K>]: ServiceImpl<K>;
} & {
  dispose(): void;
};

/**
 * Internal state for service context
 */
interface ContextState {
  disposed: boolean;
  disposers: Set<() => void>;
}

/**
 * Options for creating a context
 */
export interface CreateContextOptions {
  /**
   * Optional instrumentation context for debugging/profiling
   */
  instrumentation?: InstrumentationContext;
}

/**
 * Create a lattice context from a set of services
 *
 * Accepts services or arrays of services, automatically flattening nested arrays.
 */
export function compose<TServices extends readonly Service<string, unknown>[]>(
  ...services: TServices
): LatticeContext<TServices>;
export function compose<TServices extends readonly Service<string, unknown>[]>(
  options: CreateContextOptions,
  ...services: TServices
): LatticeContext<TServices>;
export function compose<TServices extends readonly Service<string, unknown>[]>(
  ...args: [CreateContextOptions, ...TServices] | TServices
): LatticeContext<TServices> {
  // Parse arguments - first arg might be options
  let rawServices: TServices;
  let options: CreateContextOptions | undefined;

  if (
    args.length > 0 &&
    args[0] &&
    typeof args[0] === 'object' &&
    'instrumentation' in args[0]
  ) {
    options = args[0];
    rawServices = args.slice(1) as unknown as TServices;
  } else {
    rawServices = args as TServices;
  }

  // Flatten any arrays of services
  const services = rawServices.flat(1) as unknown as TServices;

  // Check for duplicate service names
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
  const context = {
    dispose(): void {
      if (state.disposed) return;
      state.disposed = true;

      // Call service cleanup first
      for (const service of services) {
        service.destroy?.(serviceCtx);
      }

      // Then call all registered disposers
      for (const disposer of state.disposers) {
        disposer();
      }
      state.disposers.clear();
    },
  } as LatticeContext<TServices>;

  // Add each service's impl to the context
  for (const service of services) {
    // Call init lifecycle
    service.init?.(serviceCtx);

    // Start with the base impl
    let impl = service.impl;

    // Apply instrumentation if provided
    if (options?.instrumentation && service.instrument) {
      impl = service.instrument(impl, options.instrumentation, serviceCtx);
    }

    // Apply context wrapper if provided
    if (service.adapt) impl = service.adapt(impl, serviceCtx);

    // Safe because we control the context type
    (context as Record<string, unknown>)[service.name] = impl;
  }

  return context;
}
