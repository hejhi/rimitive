/**
 * Lifecycle Combinators
 *
 * Provides composable primitives for element lifecycle management based on
 * combinatory logic. These reduce boilerplate, improve type safety, and enable
 * optimizations like memoization and parallel execution.
 *
 * Core principles:
 * - Small, orthogonal primitives (easier to tree-shake)
 * - Point-free composition (less allocation overhead)
 * - Automatic cleanup composition (prevents memory leaks)
 */

import type { RefSpec, LifecycleCallback } from './types';

/**
 * Identity combinator: I(x) = x
 * Returns the element unchanged. Useful as a no-op or base case.
 *
 * @example
 * pipe(identity, onClick(handler)) // Same as just onClick(handler)
 */
export const identity = <TElement>(): LifecycleCallback<TElement> =>
  (_element: TElement) => {};

/**
 * Sequential composition: seq(f, g)(x) = compose(f(x), g(x))
 * Runs both callbacks in sequence, composing their cleanup functions.
 *
 * Key optimization: Single pass through both callbacks, single cleanup allocation.
 *
 * @example
 * const setup = seq(
 *   (el) => on(el, 'click', handleClick),
 *   (el) => on(el, 'input', handleInput)
 * );
 * el(['input'])(setup) // Both listeners attached, both cleaned up
 */
export const seq = <TElement>(
  first: LifecycleCallback<TElement>,
  second: LifecycleCallback<TElement>
): LifecycleCallback<TElement> =>
  (element: TElement) => {
    const cleanup1 = first(element);
    const cleanup2 = second(element);

    // Optimize common cases
    if (!cleanup1 && !cleanup2) return;
    if (!cleanup1) return cleanup2;
    if (!cleanup2) return cleanup1;

    // Both have cleanup - compose
    return () => {
      cleanup1();
      cleanup2();
    };
  };

/**
 * N-ary sequential composition
 * Composes multiple lifecycle callbacks into one.
 *
 * @example
 * const setup = seqAll(
 *   (el) => on(el, 'click', onClick),
 *   (el) => on(el, 'input', onInput),
 *   (el) => on(el, 'blur', onBlur)
 * );
 */
export const seqAll = <TElement>(
  ...callbacks: LifecycleCallback<TElement>[]
): LifecycleCallback<TElement> =>
  callbacks.reduce(seq, identity<TElement>());

/**
 * Pipe combinator: Left-to-right composition for RefSpecs
 * Chains lifecycle callbacks onto a RefSpec in sequence.
 *
 * @example
 * const button = pipe(
 *   el(['button', 'Click me']),
 *   (el) => on(el, 'click', handleClick),
 *   (el) => { console.log('Button mounted'); }
 * );
 */
export function pipe<TElement>(
  refSpec: RefSpec<TElement>,
  ...callbacks: LifecycleCallback<TElement>[]
): RefSpec<TElement> {
  if (callbacks.length === 0) return refSpec;

  // Compose all callbacks into one, then apply
  return refSpec(seqAll(...callbacks));
}

/**
 * Lazy evaluation combinator
 * Defers execution of a lifecycle callback until first use.
 * Useful for expensive computations that may not be needed.
 *
 * @example
 * const expensiveSetup = lazy(() => (el) => {
 *   const data = computeExpensiveData();
 *   return setupWithData(el, data);
 * });
 */
export function lazy<TElement>(
  factory: () => LifecycleCallback<TElement>
): LifecycleCallback<TElement> {
  let cached: LifecycleCallback<TElement> | null = null;

  return (element: TElement) => {
    if (!cached) cached = factory();
    return cached(element);
  };
}

/**
 * Curry combinator - creates functions that can be partially applied
 *
 * @example
 * // Event listener that can be curried
 * const on = curry((event: string, handler: Function, el: HTMLElement) => {
 *   el.addEventListener(event, handler);
 *   return () => el.removeEventListener(event, handler);
 * });
 *
 * @example
 * // Map helper with currying
 * const map = curry((items: T[], render: Function, keyFn: Function) => {
 *   // ... implementation
 * });
 */
export function curry<TFn extends (...args: never[]) => unknown>(
  fn: TFn,
  arity?: number
): (...args: unknown[]) => unknown {
  const fnArity = arity ?? fn.length;
  const oneLeft = fnArity - 1;

  return function curried(...args: unknown[]): unknown {
    const aLen = args.length;

    // All arguments provided - direct call
    if (aLen >= fnArity) return fn(...(args as Parameters<TFn>));

    // One argument short - return function waiting for last arg
    if (aLen === oneLeft)
      return (last: unknown) => fn(...([...args, last] as Parameters<TFn>));

    // Multiple arguments missing - return curried function
    return (...nextArgs: unknown[]) => curried(...args, ...nextArgs);
  };
}
