/**
 * Behavior binding helper
 *
 * Binds a portable behavior to a reactive API.
 * Behaviors are curried functions: (api) => (...args) => Result
 */

import type { ReactiveAdapter } from '../reactive-adapter';

/**
 * Creates a `use` helper bound to a specific reactive API.
 *
 * @param api - The reactive API (signal, computed, effect, batch)
 * @returns A function that binds behaviors to this API
 *
 * @example
 * ```ts
 * const { use } = createDOMSvc();
 *
 * // Define a portable behavior
 * const counter = (api: ReactiveAdapter) => (initial = 0) => {
 *   const count = api.signal(initial);
 *   return { count, increment: () => count(count() + 1) };
 * };
 *
 * // Bind to this service
 * const useCounter = use(counter);
 * const c = useCounter(10);
 * ```
 */
export const createUse = (api: ReactiveAdapter) => {
  return <Args extends unknown[], Result>(
    behavior: (api: ReactiveAdapter) => (...args: Args) => Result
  ): ((...args: Args) => Result) => {
    return behavior(api);
  };
};
