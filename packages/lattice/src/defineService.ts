import { Service } from './types';

export function defineService<TArgs extends unknown[], TResult, TContext>(
  factory: (context: TContext) => (...args: TArgs) => TResult
): (...args: TArgs) => Service<TResult, TContext> {
  return (...args: TArgs): Service<TResult, TContext> => ({
    create: (context: TContext): TResult => {
      const component = factory(context);
      return component(...args);
    },
  });
}
