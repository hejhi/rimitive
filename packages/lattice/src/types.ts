/**
 * Generic component composition pattern for Lattice
 *
 * Provides a pattern for defining components with deferred context injection.
 * This allows components to be defined independently of their runtime context,
 * then instantiated later with the actual context provided.
 *
 * A Service is a function that accepts context and returns the instantiated result.
 */
export type Service<TResult, TContext> = (context: TContext) => TResult;
