/**
 * Generic component composition pattern for Lattice
 *
 * Provides a pattern for defining components with deferred context injection.
 * This allows components to be defined independently of their runtime context,
 * then instantiated later with the actual context provided.
 */
export interface Instantiatable<TResult, TContext> {
  /**
   * Create an instance with the provided context
   *
   * @param context - The context required to instantiate the component
   * @returns The instantiated result
   */
  create(context: TContext): TResult;
}

/**
 * Generic component factory that injects context at instantiation time
 *
 * This function enables the component composition pattern where:
 * 1. Components are defined with a factory that receives context
 * 2. Components can be "called" with their arguments to create an Instantiatable
 * 3. The Instantiatable is later instantiated with .create(context)
 *
 * This pattern defers component instantiation until the context is available,
 * allowing components to be defined, configured, and composed independently
 * of their runtime context.
 */
export function create<TArgs extends unknown[], TResult, TContext>(
  factory: (context: TContext) => (...args: TArgs) => TResult
): (...args: TArgs) => Instantiatable<TResult, TContext> {
  return (...args: TArgs): Instantiatable<TResult, TContext> => ({
    create: (context: TContext): TResult => {
      const component = factory(context);
      return component(...args);
    },
  });
}
