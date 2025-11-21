import { ServiceDefinition } from './types';

/**
 * Generic component factory that injects context at instantiation time
 *
 * This function enables the component composition pattern where:
 * 1. Components are defined with a factory that receives context
 * 2. Components can be "called" with their arguments to create an ServiceDefinition
 * 3. The ServiceDefinition is later instantiated with .create(context)
 *
 * This pattern defers component instantiation until the context is available,
 * allowing components to be defined, configured, and composed independently
 * of their runtime context.
 */
export function defineService<TArgs extends unknown[], TResult, TContext>(
  factory: (context: TContext) => (...args: TArgs) => TResult
): (...args: TArgs) => ServiceDefinition<TResult, TContext> {
  return (...args: TArgs): ServiceDefinition<TResult, TContext> => ({
    create: (context: TContext): TResult => {
      const component = factory(context);
      return component(...args);
    },
  });
}
