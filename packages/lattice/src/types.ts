export interface Service<TResult, TContext> {
  /**
   * Create an instance with the provided context
   *
   * @param context - The context required to instantiate the component
   * @returns The instantiated result
   */
  create(context: TContext): TResult;
}

/**
 * Base interface for all lattice services
 */
export interface ServiceDefinition<TName extends string, TImpl> {
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
 * Helper type to extract the impl type from an service
 */
export type ServiceImpl<TService> =
  TService extends ServiceDefinition<string, infer M> ? M : never;

/**
 * Helper type to extract the name from an service
 */
export type ServiceName<TService> =
  TService extends ServiceDefinition<infer N, unknown> ? N : never;

/**
 * Convert a tuple of services into a context type
 */
export type LatticeContext<
  TService extends readonly ServiceDefinition<string, unknown>[],
> = {
  [K in TService[number] as ServiceName<K>]: ServiceImpl<K>;
} & {
  dispose(): void;
};

export type DefinedService<TDeps = unknown> = Service<
  ServiceDefinition<string, TDeps>,
  TDeps
>;

// Helper to extract context requirements from instantiables
// Uses UnionToIntersection to combine all context requirements
export type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export type ExtractDeps<T extends Record<string, DefinedService>> =
  UnionToIntersection<T[keyof T] extends Service<unknown, infer C> ? C : never>;
