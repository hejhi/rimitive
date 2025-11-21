import { Service } from './types';

/**
 * Generic component factory that injects context at instantiation time
 *
 * This function enables the component composition pattern where:
 * 1. Components are defined with a factory that receives context
 * 2. Components can be "called" with their arguments to create a Service
 * 3. The Service is later called with context to instantiate
 *
 * This pattern defers component instantiation until the context is available,
 * allowing components to be defined, configured, and composed independently
 * of their runtime context.
 */
export function defineService<TArgs extends unknown[], TResult, TContext>(
  factory: (context: TContext) => (...args: TArgs) => TResult
): (...args: TArgs) => Service<TResult, TContext> {
  return (...args: TArgs) => (context: TContext) => {
    const component = factory(context);
    return component(...args);
  };
}
