/**
 * Generic component composition pattern for Lattice
 *
 * Provides a pattern for defining components with deferred context injection.
 * This allows components to be defined independently of their runtime context,
 * then instantiated later with the actual context provided.
 */
export interface ServiceDefinition<TResult, TContext> {
  /**
   * Create an instance with the provided context
   *
   * @param context - The context required to instantiate the component
   * @returns The instantiated result
   */
  create(context: TContext): TResult;
}
