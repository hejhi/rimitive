import { Service } from './types';

/**
 * Define a composable service factory with dependency injection.
 *
 * This is the foundational building block for creating Lattice services.
 * It implements a double-function pattern:
 * 1. Outer function receives dependencies (injected at composition time)
 * 2. Inner function receives user arguments (passed when creating instances)
 *
 * The returned factory has a `.create(deps)` method that wires dependencies.
 *
 * @example Basic service definition
 * ```ts
 * import { defineService } from '@lattice/lattice';
 *
 * type CounterDeps = { logger: (msg: string) => void };
 *
 * const Counter = defineService(
 *   ({ logger }: CounterDeps) =>           // deps injected at compose time
 *     (initialValue: number) => ({         // args passed by user
 *       name: 'counter',
 *       impl: {
 *         value: initialValue,
 *         increment() {
 *           this.value++;
 *           logger(`Counter: ${this.value}`);
 *         },
 *       },
 *     })
 * );
 *
 * // Usage with compose
 * const ctx = compose(
 *   { counter: Counter(0) },
 *   { logger: console.log }
 * );
 * ctx.counter.increment(); // logs "Counter: 1"
 * ```
 *
 * @example Service with lifecycle hooks
 * ```ts
 * const TimerService = defineService(
 *   ({ interval }: { interval: number }) =>
 *     () => ({
 *       name: 'timer',
 *       impl: { elapsed: 0 },
 *       init(ctx) {
 *         const id = setInterval(() => this.impl.elapsed++, interval);
 *         ctx.destroy(() => clearInterval(id));
 *       },
 *     })
 * );
 * ```
 *
 * @param factory - Double-function: `(deps) => (...args) => ServiceDefinition`
 * @returns A factory function that returns a `Service` with `.create(deps)` method
 */
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
