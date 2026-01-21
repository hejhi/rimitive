/**
 * Merge utility for extending composed contexts
 *
 * @module
 */

import type { Use } from './types';

/**
 * Merge additional properties into a Use context.
 *
 * Creates a new `Use` that has all properties from the base plus the additions.
 * The base service instances are preserved (not cloned), so you stay on the
 * same reactive graph.
 *
 * @example
 * ```ts
 * import { compose, merge } from '@rimitive/core';
 * import { SignalModule } from '@rimitive/signals/extend';
 *
 * const svc = compose(SignalModule);
 *
 * // Add new properties
 * const extended = merge(svc, { theme: createTheme() });
 * extended.theme; // available
 * extended.signal; // same instance as svc.signal
 *
 * // Override existing properties for a subtree
 * const childSvc = merge(svc, { signal: customSignal });
 * ```
 *
 * @example Inside a behavior
 * ```ts
 * const myBehavior = (svc) => {
 *   // Add router for this subtree
 *   const childSvc = merge(svc, createRouter(svc));
 *
 *   return () => childSvc(ChildComponent);
 * };
 * ```
 */
export function merge<TSvc, TAdditions extends object>(
  base: Use<TSvc>,
  additions: TAdditions
): Use<Omit<TSvc, keyof TAdditions> & TAdditions> {
  const merged = { ...base, ...additions };

  type MergedType = typeof merged;

  // Create a new callable that passes ITSELF to the callback
  // This allows portables to call other portables using the same Use object
  const mergedUse = (<TResult>(fn: (svc: MergedType) => TResult) =>
    fn(mergedUse)) as Use<MergedType>;

  Object.assign(mergedUse, merged);

  return mergedUse;
}
