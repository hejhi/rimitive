import { Service } from './types';

export function defineService<TArgs extends unknown[], TResult, TContext>(
  factory: (context: TContext) => (...args: TArgs) => TResult
): (...args: TArgs) => Service<TResult, TContext> {
  return (...args: TArgs) =>
    (context: TContext) => {
      const component = factory(context);
      return component(...args);
    };
}
